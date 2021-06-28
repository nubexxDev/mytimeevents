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

			// Set control model
			this.setModel(models.createControlModel(), "control");

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
			var oControlModel = this.getModel("control");

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
				oModel = this.getOwnerComponent().getModel(),
				oControlModel = this.getModel("control");

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
							oControlModel.setProperty("/Pernr", oData.results[0].Pernr);

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
			var oText = this.byId("selectedDate");
			if (oSelectedDay) {
				oText.setText(this.oFormatYyyymmdd.format(oSelectedDay.getStartDate()));
				return;
			}
			oText.setText(this.getResourceBundle().getText("noDateSelected"));
		},

		resetView: function () {
			this.getView().getModel().resetChanges();
			this.getView().unbindElement();
			this.byId("workingHrsInput").setValue("");
			this.byId("endWorkingTP").setValueState(sap.ui.core.ValueState.None);
		},

		getUTCDate: function (oDate) {
			return new Date(oDate.getTime() + oDate.getTimezoneOffset() * (-60000));
		},

		adjustBreak: function () {
			var oStartWorking = this.byId("startWorkingTP"),
				oEndWorking = this.byId("endWorkingTP"),
				dInitialTime = new Date(),
				dEndTime = new Date();

			if (oStartWorking.getValue() && oEndWorking.getValue()) {
				var aStartTime = oStartWorking.getValue().split(":"),
					aEndTime = oEndWorking.getValue().split(":");

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
				var oWorkingHours = this.byId("workingHrsInput");
				oWorkingHours.setValue(iHours);
			}
		},
		
		/* =========================================================== */
		/* Validations/Formatter		                               */
		/* =========================================================== */
		
		validateButton: function(bEnabled, oStartTime) {
			if(!bEnabled || !this.validateTimes()) {
				return false;
			}
			
			return true;
		},
		
		validateTimes: function() {
			var oStartTime = this.byId("startWorkingTP").getDateValue(),
				oEndTime = this.byId("endWorkingTP").getDateValue();
				
			if(oStartTime.valueOf() >= oEndTime.valueOf()) {
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
				oStartDate = oSelectedDate.getStartDate();
			if (this.oLastSelectedJSDate && oStartDate.getTime() === this.oLastSelectedJSDate.getTime()) {
				oCalendar.removeSelectedDate(oSelectedDate);
				this.oLastSelectedJSDate = null;
				this.resetView();
			} else {
				this.oLastSelectedJSDate = oStartDate;

				this.bindView(oStartDate);
			}
			this.updateSelectedDayText(oCalendar.getSelectedDates()[0]);
		},

		onChangeTime: function (oEvent) {
			var oStartWorking = this.byId("startWorkingTP"),
				oEndWorking = this.byId("endWorkingTP");

			if(!this.validateTimes()) {
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
			var oModel = this.getOwnerComponent().getModel(),
				oControlModel = this.getModel("control"),
				oSelectedDate = this.getView().byId("timeCalendar").getSelectedDates()[0].getStartDate();

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

		},

		onPressEdit: function (oEvent) {
			var oModel = this.getView().getModel();

			if (oModel.hasPendingChanges()) {
				this.getView().setBusy(true);
				oModel.submitChanges({
					success: function (data) {
						oModel.refresh();
						this.getView().setBusy(false);
						MessageToast.show(this.getResourceBundle().getText("successUpadteEvent"));
						this.getCalendar();
					}.bind(this),
					error: function (error) {
						this.getView().setBusy(false);
						MessageToast.show(this.getResourceBundle().getText("errorUpdateEvent"));
					}.bind(this)
				});
			}
		},

		onPressDelete: function (oEvent) {
			var oModel = this.getView().getModel(),
				oControlModel = this.getModel("control"),
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

		}
	});
});