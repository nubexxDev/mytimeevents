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
	"sap/m/MessageToast"
], function (BaseController, JSONModel, formatter, DateTypeRange, DateFormat, coreLibrary, Filter, models, FilterOperator, ODataModel,
	MessageToast) {
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
		},

		/* =========================================================== */
		/* Methods                                          		   */
		/* =========================================================== */

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
				switch (aCalendarDates[i].Status) {
				case "06" || "08":
					sTooltyp = "Backend Text";
					sColor = "#1cb048";
					break;

				case "07" || "09":
					sTooltyp = "Error";
					sColor = "#ff7e29";
					break;

				case "04": //Working Days
					continue;

				case "05": //Not Working Days
					sTooltyp = "";
					sType = "NonWorking";
					break;

				default:
					break;
				}

				oCal1.addSpecialDate(new DateTypeRange({
					startDate: new Date(aCalendarDates[i].CalendarDate),
					color: sColor,
					type: sType,
					tooltip: sTooltyp
				}));

				// oCal1.addSpecialDate(new DateTypeRange({
				// 	startDate: new Date(aCalendarDates[i].CalendarDate),
				// 	type: "NonWorking",
				// 	tooltip: sTooltyp
				// }));

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
			return new Date(oDate.getTime() + oDate.getTimezoneOffset() * (-60000));
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

			if (oStartTime.valueOf() >= oEndTime.valueOf()) {
				return false;
			}

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
				this.getView().getModel().setProperty(this.getView().getBindingContext().getPath() + "/StartWorking/ms", oUTCStartWorking.getTime());
				this.getView().getModel().setProperty(this.getView().getBindingContext().getPath() + "/EndWorking/ms", oUTCEndWorking.getTime());
			}
		},

		onChangeMonth: function (oEvent) {
			this.getCalendar();
		},

		onChangeBreak: function (oEvent) {
			this.adjustBreak();

			if (this.getView().getBindingContext()) {
				this.getView().getModel().setProperty(this.getView().getBindingContext().getPath() + "/WorkingBreak", oEvent.getSource().getSelected());
			}
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
				}.bind(this),
				error: function (error) {
					this.getView().setBusy(false);
					MessageToast.show(this.getResourceBundle().getText("errorDeleteEvent"));
				}.bind(this)
			});

			// this.getView().byId("createButton").setVisible(true);
			// this.getView().byId("createButton").setEnabled(true);

			// this.getView().byId("editButton").setVisible(false);
			// this.getView().byId("deleteButton").setVisible(false);

			oControlModel.setProperty("/isDisplayMode", true);
			oControlModel.setProperty("/isEditMode", false);

			this.getView().byId("workingHrsInput").setValue(0);
			this.getView().byId("workingHrsText").setText("0");
		},

		onPressSave: function (oEvent) {
			var oModel = this.getOwnerComponent().getModel(),
				oControlModel = this.getModel("controlModel"),
				oSelectedDate = this.getView().byId("timeCalendar").getSelectedDates()[0].getStartDate();

			var isEditMode = oControlModel.getProperty("/isEditMode");

			if (isEditMode) {
				if (oModel.hasPendingChanges()) {
					this.getView().setBusy(true);
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
					StartWorking: timeFormat.format(this.getView().byId("startWorkingTP").getDateValue()),
					EndWorking: timeFormat.format(this.getView().byId("endWorkingTP").getDateValue()),
					WorkingBreak: this.getView().byId("checkBreak").getSelected()
				};

				this.getView().setBusy(true);

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

		onPressCancel: function (oEvent) {
			var oCalendar = this.getView().byId("timeCalendar"),
				oSelectedDate = oCalendar.getSelectedDates()[0],
				oStartDate = oSelectedDate.getStartDate(),
				oControlModel = this.getModel("controlModel");

			this.oLastSelectedJSDate = oStartDate;
			this.bindView(oStartDate);

			oControlModel.setProperty("/isDisplayMode", true);
			oControlModel.setProperty("/isEditMode", false);
		}
	});
});