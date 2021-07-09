sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"../model/formatter",
	"sap/ui/unified/DateTypeRange",
	"sap/ui/core/format/DateFormat",
	"sap/ui/core/library",
	"sap/ui/model/Filter",
	"../model/models",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/odata/v2/ODataModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/core/Core"
], function (BaseController, JSONModel, formatter, DateTypeRange, DateFormat, coreLibrary, Filter, models, FilterOperator, ODataModel,
	MessageToast, MessageBox, Core) {
	"use strict";

	var CalendarType = coreLibrary.CalendarType;

	return BaseController.extend("hr.computacenter.mytimeevents.controller.Main", {
		oFormatYyyymmdd: null,
		formatter: formatter,

		/* =========================================================== */
		/* Lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the Main controller is instantiated.
		 * @public
		 */
		onInit: function () {

			this.getView().setBusy(true);

			this.oFormatYyyymmdd = DateFormat.getInstance({
				pattern: "yyyy-MM-dd",
				calendarType: CalendarType.Gregorian
			});

			this.getCalendar(true);
			
			this._MessageManager = Core.getMessageManager();
			
			this._oMessagePopover = sap.ui.xmlfragment("hr.computacenter.mytimeevents.view.fragments.messageDialog", this);
			this.getView().addDependent(this._oMessagePopover);
		},

		/* =========================================================== */
		/* Methods                                          		   */
		/* =========================================================== */
		// Display the button type according to the message with the highest severity
		// The priority of the message types are as follows: Error > Warning > Success > Info
		buttonTypeFormatter: function () {
			var sHighestSeverity;
			var aMessages = this._MessageManager.getMessageModel().oData;
			aMessages.forEach(function (sMessage) {
				switch (sMessage.type) {
					case "Error":
						sHighestSeverity = "Negative";
						break;
					case "Warning":
						sHighestSeverity = sHighestSeverity !== "Negative" ? "Critical" : sHighestSeverity;
						break;
					case "Success":
						sHighestSeverity = sHighestSeverity !== "Negative" && sHighestSeverity !== "Critical" ?  "Success" : sHighestSeverity;
						break;
					default:
						sHighestSeverity = !sHighestSeverity ? "Neutral" : sHighestSeverity;
						break;
				}
			});

			return sHighestSeverity;
		},

		// Display the number of messages with the highest severity
		highestSeverityMessages: function () {
			var sHighestSeverityIconType = this.buttonTypeFormatter();
			var sHighestSeverityMessageType;

			switch (sHighestSeverityIconType) {
				case "Negative":
					sHighestSeverityMessageType = "Error";
					break;
				case "Critical":
					sHighestSeverityMessageType = "Warning";
					break;
				case "Success":
					sHighestSeverityMessageType = "Success";
					break;
				default:
					sHighestSeverityMessageType = !sHighestSeverityMessageType ? "Information" : sHighestSeverityMessageType;
					break;
			}

			return this._MessageManager.getMessageModel().oData.reduce(function(iNumberOfMessages, oMessageItem) {
				return oMessageItem.type === sHighestSeverityMessageType ? ++iNumberOfMessages : iNumberOfMessages;
			}, 0) || "";
		},

		// Set the button icon according to the message with the highest severity
		buttonIconFormatter: function () {
			var sIcon;
			var aMessages = this._MessageManager.getMessageModel().oData;

			aMessages.forEach(function (sMessage) {
				switch (sMessage.type) {
					case "Error":
						sIcon = "sap-icon://message-error";
						break;
					case "Warning":
						sIcon = sIcon !== "sap-icon://message-error" ? "sap-icon://message-warning" : sIcon;
						break;
					case "Success":
						sIcon = "sap-icon://message-error" && sIcon !== "sap-icon://message-warning" ? "sap-icon://message-success" : sIcon;
						break;
					default:
						sIcon = !sIcon ? "sap-icon://message-information" : sIcon;
						break;
				}
			});

			return sIcon;
		},

		bindView: function (oCalendarDate) {
			var oUTCCalendarDate = this.getUTCDate(oCalendarDate);
			var oEventModel = this.getOwnerComponent().getModel();
			var oControlModel = this.getModel("controlModel");

			var sPath = "/" + oEventModel.createKey("EventSet", {
				Pernr: oControlModel.getProperty("/Pernr"),
				CalendarDate: oUTCCalendarDate
			});

			this.resetView();

			this.getView().bindElement({
				path: sPath,
				events: {
					change: function (oEvent) {
						this.adjustBreak();
					}.bind(this),
					dataRequested: function () {
						this.getView().setBusy(true);
					}.bind(this),
					dataReceived: function (oData) {
						this.getView().setBusy(false);
					}.bind(this)
				}
			});

		},

		getCalendar: function (bFirstRun) {
			var oCalendar = this.byId("timeCalendar"),
				oStartDate = oCalendar.getStartDate(),
				calendarMonth = oStartDate.getMonth() + 1,
				calendarYear = oStartDate.getFullYear(),
				oModel = this.getOwnerComponent().getModel();

			oCalendar.removeAllSpecialDates();
			this.getView().setBusy(true);

			oModel.metadataLoaded().then(function () {
				sap.ui.getCore().getMessageManager().removeAllMessages();
				oModel.read("/CalendarSet", {
					filters: [
						// new Filter("Pernr", ""), 
						new Filter("CalendarMonth", FilterOperator.EQ, calendarMonth),
						new Filter("CalendarYear", FilterOperator.EQ, calendarYear)
					],
					success: function (oData) {
						if (oData.results && oData.results.length > 0) {
							this.getModel("controlModel").setProperty("/Pernr", oData.results[0].Pernr);

							var oCalendarModel = new sap.ui.model.json.JSONModel(oData.results);
							this.getView().setModel(oCalendarModel, "CalendarModel");
							this.setSpecialDays(oCalendarModel.getData());
							this.getView().setBusy(false);
							if (bFirstRun) {
								oCalendar.addSelectedDate(new DateTypeRange({
									startDate: new Date()
								}));
								oCalendar.fireSelect();
							}
							return;
						}

						this.getView().setBusy(false);

					}.bind(this),
					error: function (error) {
						this.getView().setBusy(false);
						sap.m.MessageToast.show(this.getResourceBundle().getText("calendarSetError"));
					}.bind(this)
				});
			}.bind(this));
		},

		setSpecialDays: function (aCalendarDates) {
			var oCal1 = this.byId("timeCalendar"),
				sColor,
				sType,
				sTooltyp;

			for (var i = 0; i < aCalendarDates.length; i++) {
				sColor = null;
				sType = null;
				switch (aCalendarDates[i].MaintenanceStatus) {
				case "C":
					sTooltyp = aCalendarDates[i].HolidayText;
					sColor = "#1cb048"; //Green
					sType = sap.ui.unified.CalendarDayType.Type03;
					break;
				case "D":
					sTooltyp = aCalendarDates[i].HolidayText;
					sColor = "#ff7e29"; //Orange
					sType = sap.ui.unified.CalendarDayType.Type02;
					break;
				case "I":
					//continue;
					break;
				default:
					break;
				}

				if (sColor !== null) {
					oCal1.addSpecialDate(new DateTypeRange({
						startDate: new Date(aCalendarDates[i].CalendarDate),
						color: sColor,
						type: sType,
						tooltip: sTooltyp
					}));
				}

				if (aCalendarDates[i].Status === "05") {
					oCal1.addSpecialDate(new DateTypeRange({
						startDate: new Date(aCalendarDates[i].CalendarDate),
						type: "NonWorking",
						sColor: "#dedede",
						tooltip: "Dummy" //aCalendarDates[i].HolidayText
					}));
				}

			}
		},

		updateSelectedDayText: function (oSelectedDay) {
			var oText;
			var oControlModel = this.getModel("controlModel");
			var isDisplayMode = oControlModel.getProperty("/isDisplayMode");

			if (isDisplayMode) {
				oText = this.byId("selectedDateDisplay");
			} else {
				oText = this.byId("selectedDate");
			}

			if (oSelectedDay) {
				oText.setText(this.oFormatYyyymmdd.format(oSelectedDay.getStartDate()));
				return;
			}
			oText.setText(this.getResourceBundle().getText("noDateSelected"));
		},

		resetView: function () {
			// this.getView().getModel().resetChanges();
			// this.getView().unbindElement();

			var oControlModel = this.getModel("controlModel");
			var isDisplayMode = oControlModel.getProperty("/isDisplayMode");

			if (!isDisplayMode) {
				// 	this.byId("workingHrsText").setText("");
				// } else {
				// 	this.byId("workingHrsInput").setValue("");
				this.byId("endWorkingTP").setValueState(sap.ui.core.ValueState.None);
			}
		},

		getUTCDate: function (oDate) {
			if (oDate && oDate.getTime()) {
				return new Date(oDate.getTime() + oDate.getTimezoneOffset() * (-60000));
			}
		},

		adjustBreak: function () {
			var dInitialTime = new Date(),
				dEndTime = new Date(),
				aStartTime,
				aEndTime;

			var oControlModel = this.getModel("controlModel");
			var isDisplayMode = oControlModel.getProperty("/isDisplayMode");

			if (isDisplayMode) {
				var oStartWorkingTxt = this.byId("startWorkingText"),
					oEndWorkingTxt = this.byId("endWorkingText");

				aStartTime = oStartWorkingTxt.getText().split(":");
				aEndTime = oEndWorkingTxt.getText().split(":");
			} else {
				var oStartWorking = this.byId("startWorkingTP"),
					oEndWorking = this.byId("endWorkingTP");

				if (oStartWorking.getValue() && oEndWorking.getValue()) {
					aStartTime = oStartWorking.getValue().split(":");
					aEndTime = oEndWorking.getValue().split(":");
				}
			}

			dInitialTime.setHours(aStartTime[0], aStartTime[1], "00");
			dEndTime.setHours(aEndTime[0], aEndTime[1], "00");

			var iHours = dEndTime.getHours() - dInitialTime.getHours(),
				iMinutes = dEndTime.getMinutes() - dInitialTime.getMinutes();

			if (iHours < 0) return;

			var oCheckBreak = this.byId("checkBreak");
			if (oCheckBreak.getSelected() === true && iHours > 0) {
				iHours--;
			}

			if (iMinutes < 0 && iHours > 0) {
				iHours--;
			}

			var oWorkingHoursTxt = this.byId("workingHrsText"),
				oWorkingHours = this.byId("workingHrsInput");

			oWorkingHoursTxt.setText(iHours);
			oWorkingHours.setValue(iHours);
		},

		/* =========================================================== */
		/* Validations/Formatter		                               */
		/* =========================================================== */

		validateButton: function (bEnabled, oStartTime) {
			if (!bEnabled || !this.validateTimes()) {
				return false;
			}

			return true;
		},

		validateTimes: function () {
			var oStartTime = this.byId("startWorkingTP").getDateValue(),
				oEndTime = this.byId("endWorkingTP").getDateValue();

			// if (oStartTime.valueOf() >= oEndTime.valueOf()) {
			// 	return false;
			// }

			return true;
		},

		/* =========================================================== */
		/* Event handlers                                              */
		/* =========================================================== */

		onSelectDay: function (oEvent) {
			var oCalendar = oEvent.getSource(),
				oSelectedDate = oCalendar.getSelectedDates()[0],
				oStartDate = oSelectedDate.getStartDate(),
				oControlModel = this.getModel("controlModel");

			if (this.oLastSelectedJSDate && oStartDate.getTime() === this.oLastSelectedJSDate.getTime()) {
				oCalendar.removeSelectedDate(oSelectedDate);
				this.oLastSelectedJSDate = null;
				this.resetView();
				oControlModel.setProperty("/isDateSelected", false);
			} else {
				oControlModel.setProperty("/isDateSelected", true);
				this.oLastSelectedJSDate = oStartDate;
				this.bindView(oStartDate);

			}
			oControlModel.setProperty("/isDisplayMode", true);

			this.updateSelectedDayText(oCalendar.getSelectedDates()[0]);
		},

		onChangeTime: function (oEvent) {
			var oStartWorking = this.byId("startWorkingTP"),
				oEndWorking = this.byId("endWorkingTP");

			if (!this.validateTimes()) {
				oEndWorking.setValueState(sap.ui.core.ValueState.Error);
				oEndWorking.setValueStateText(this.getResourceBundle().getText("timeErrorState"));
			} else {
				oEndWorking.setValueState(sap.ui.core.ValueState.None);
			}

			this.adjustBreak();

			if (this.getView().getBindingContext()) {

				var oUTCStartWorking = this.getUTCDate(oStartWorking.getDateValue());
				var oUTCEndWorking = this.getUTCDate(oEndWorking.getDateValue());
				if (oUTCStartWorking) {
					this.getView().getModel().setProperty(this.getView().getBindingContext().getPath() + "/StartTime/ms", oUTCStartWorking.getTime());
				} else {
					this.getView().getModel().setProperty(this.getView().getBindingContext().getPath() + "/StartTime/ms", 0);
				}
				if (oUTCEndWorking) {
					this.getView().getModel().setProperty(this.getView().getBindingContext().getPath() + "/EndTime/ms", oUTCEndWorking.getTime());
				} else {
					this.getView().getModel().setProperty(this.getView().getBindingContext().getPath() + "/EndTime/ms", 0);
				}
			}
		},

		onChangeMonth: function (oEvent) {
			this.getCalendar();
		},

		onChangeBreak: function (oEvent) {
			this.adjustBreak();

			if (this.getView().getBindingContext()) {
				this.getView().getModel().setProperty(this.getView().getBindingContext().getPath() + "/BreakFlag", oEvent.getSource().getSelected());
			}
		},
		
		onOpenMessagePopover: function(oEvent) {
			this._oMessagePopover.openBy(oEvent.getSource());
		},

		onPressCreate: function (oEvent) {
			var oControlModel = this.getModel("controlModel");

			this.getView().byId("titleEdit").setText(this.getResourceBundle().getText("formTitleCreate"));

			oControlModel.setProperty("/isDisplayMode", false);
			this.getView().byId("createButton").setVisible(false);
			this.updateSelectedDayText(this.getView().byId("timeCalendar").getSelectedDates()[0]);
		},

		onPressEdit: function (oEvent) {
			var oControlModel = this.getModel("controlModel");

			this.getView().byId("titleEdit").setText(this.getResourceBundle().getText("formTitleEdit"));
			oControlModel.setProperty("/isEditMode", true);
			oControlModel.setProperty("/isDisplayMode", false);
			this.updateSelectedDayText(this.getView().byId("timeCalendar").getSelectedDates()[0]);
		},

		onPressDelete: function (oEvent) {
			this.openDeleteMessageBox();
		},

		deleteRecord: function () {
			var oModel = this.getView().getModel(),
				oControlModel = this.getModel("controlModel"),
				oSelectedDate = this.getView().byId("timeCalendar").getSelectedDates()[0].getStartDate();

			var oUTCSelectedDate = this.getUTCDate(oSelectedDate);

			var sPath = "/" + oModel.createKey("EventSet", {
				Pernr: oControlModel.getProperty("/Pernr"),
				CalendarDate: oUTCSelectedDate
			});

			this.getView().setBusy(true);

			oModel.remove(sPath, {
				success: function (data) {
					oModel.refresh();
					this.byId("endWorkingTP").setValueState(sap.ui.core.ValueState.None);
					this.getView().setBusy(false);
					MessageToast.show(this.getResourceBundle().getText("successDeleteEvent"));
					this.getCalendar();
					oControlModel.setProperty("/isDisplayMode", true);
					oControlModel.setProperty("/isEditMode", false);

					this.getView().byId("workingHrsInput").setValue(0);
					this.getView().byId("workingHrsText").setText("0");
				}.bind(this),
				error: function (error) {
					this.getView().setBusy(false);
					MessageToast.show(this.getResourceBundle().getText("errorDeleteEvent"));
				}.bind(this)
			});

		},

		onPressSave: function (oEvent) {
			var oModel = this.getOwnerComponent().getModel(),
				oStartWorking = this.byId("startWorkingTP"),
				oEndWorking = this.byId("endWorkingTP"),
				oControlModel = this.getModel("controlModel"),
				oSelectedDate = this.getView().byId("timeCalendar").getSelectedDates()[0].getStartDate();

			if (!oStartWorking.getValue()) {
				oStartWorking.setValue("00:00");
			}
			if (!oEndWorking.getValue()) {
				oEndWorking.setValue("00:00");
			}

			var isEditMode = oControlModel.getProperty("/isEditMode");
			if (isEditMode) {
				if (oModel.hasPendingChanges()) {
					this.getView().setBusy(true);
					sap.ui.getCore().getMessageManager().removeAllMessages();
					oModel.submitChanges({
						success: function (data) {
							oModel.refresh();
							this.getView().setBusy(false);
							MessageToast.show(this.getResourceBundle().getText("successUpdateEvent"));
							this.getCalendar();
						}.bind(this),
						error: function (error) {
							this.getView().setBusy(false);
							MessageToast.show(this.getResourceBundle().getText("errorUpdateEvent"));
						}.bind(this)
					});
				}

				oControlModel.setProperty("/isEditMode", false);
			} else {
				var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({
					source: {
						pattern: "HH:mm:ss"
					},
					pattern: "PTHH'H'mm'M'ss'S'"
				});

				var oEntry = {
					Pernr: oControlModel.getProperty("/Pernr"),
					CalendarDate: this.getUTCDate(oSelectedDate),
					StartTime: timeFormat.format(this.getView().byId("startWorkingTP").getDateValue()),
					EndTime: timeFormat.format(this.getView().byId("endWorkingTP").getDateValue()),
					WorkingHours: this.getView().byId("workingHrsInput").getValue(),
					BreakFlag: this.getView().byId("checkBreak").getSelected()
				};

				this.getView().setBusy(true);
				sap.ui.getCore().getMessageManager().removeAllMessages();
				oModel.create("/EventSet", oEntry, {
					success: function (data, response) {
						this.getView().setBusy(false);
						MessageToast.show(this.getResourceBundle().getText("successCreateEvent"));
						oModel.refresh();
						this.getCalendar();
					}.bind(this),
					error: function (error) {
						this.getView().setBusy(false);
						MessageToast.show(this.getResourceBundle().getText("errorCreateEvent"));
					}.bind(this)
				});
			}

			this.bindView(oSelectedDate);
			this.adjustBreak();
			oControlModel.setProperty("/isDisplayMode", true);
		},
		
		onMessagesClose: function () {
			sap.ui.getCore().getMessageManager().removeAllMessages();
		},
		
		onPressCancel: function (oEvent) {
			var oCalendar = this.getView().byId("timeCalendar"),
				oSelectedDate = oCalendar.getSelectedDates()[0],
				oStartDate = oSelectedDate.getStartDate(),
				oControlModel = this.getModel("controlModel");

			this.oLastSelectedJSDate = oStartDate;
			this.bindView(oStartDate);

			oControlModel.setProperty("/isDisplayMode", true);
			oControlModel.setProperty("/isEditMode", false);
		},

		openDeleteMessageBox: function (oEvent) {
			MessageBox.warning(this.getResourceBundle().getText("deleteMessageBoxText"), {
				actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				emphasizedAction: MessageBox.Action.OK,
				onClose: function (sAction) {
					if (sAction === MessageBox.Action.OK) {
						this.deleteRecord();
					}
				}.bind(this)
			});
		}
	});
});