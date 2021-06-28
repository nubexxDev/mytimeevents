sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device",
	"sap/base/util/ObjectPath"
], function (JSONModel, Device, ObjectPath) {
	"use strict";

	return {


		setAppModel: function () {
			var oModel = new JSONModel({
					"accountId": ""
				}
			);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},
		

		createDeviceModel: function () {
			var oModel = new JSONModel(Device);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},

		createFLPModel: function () {
			var fnGetUser = ObjectPath.get("sap.ushell.Container.getUser"),
				bIsShareInJamActive = fnGetUser ? fnGetUser().isJamActive() : false,
				oModel = new JSONModel({
					isShareInJamActive: bIsShareInJamActive
				});
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},
		
		createControlModel : function () {
			var oModel = new JSONModel({
				Pernr: "",
				NonWorkingDays: [] //Not working days comming from entity CalendarSet
			});
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		}

	};

});