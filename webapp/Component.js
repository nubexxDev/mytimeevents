sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"hr/computacenter/mytimeevents/model/models"
], function (UIComponent, Device, models) {
	"use strict";

	return UIComponent.extend("hr.computacenter.mytimeevents.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @publica
		 * @override
		 */
		init: function () {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// enable routing
			this.getRouter().initialize();
			
			// set control model
			this.setModel(models.createControlModel(), "controlModel");

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
		}
	});
});