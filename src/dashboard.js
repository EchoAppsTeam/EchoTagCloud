(function($) {
"use strict";

if (Echo.AppServer.Dashboard.isDefined("Echo.Apps.TagCloud.Dashboard")) return;

var dashboard = Echo.AppServer.Dashboard.manifest("Echo.Apps.TagCloud.Dashboard");

dashboard.inherits = Echo.Utils.getComponent("Echo.AppServer.Dashboards.AppSettings");

dashboard.mappings = {
	"dependencies.appkey": {
		"key": "dependencies.StreamServer.appkey"
	}
};

dashboard.dependencies = [{
	"url": "{config:cdnBaseURL.apps.appserver}/controls/configurator.js",
	"control": "Echo.AppServer.Controls.Configurator"
}, {
	"url": "{config:cdnBaseURL.apps.dataserver}/full.pack.js",
	"control": "Echo.DataServer.Controls.Pack"
}, {
	"url": "//cdn.echoenabled.com/apps/echo/social-map/v1/slider.js"
}, {
	"url": "//cdn.echoenabled.com/apps/echo/social-map/v1/colorpicker.js"
}];

dashboard.config.ecl = [{
	"component": "Group",
	"name": "presentation",
	"type": "object",
	"config": {
		"title": "Presentation"
	},
	"items": [{
		"component": "Select",
		"name": "visualization",
		"type": "string",
		"default": "3D",
		"config": {
			"title": "Mode",
			"desc": "Specifies visualization mode (2D or 3D)",
			"options": [{
				"title": "3D",
				"value": "3D"
			}, {
				"title": "2D",
				"value": "2D"
			}]
		}
	}, {
		"component": "Select",
		"name": "skin",
		"type": "string",
		"default": "tag",
		"config": {
			"title": "Skin",
			"desc": "Specifies tag look and feel",
			"options": [{
				"title": "Tag",
				"value": "tag"
			}, {
				"title": "Block",
				"value": "block"
			}, {
				"title": "Text only",
				"value": "text"
			}]
		}
	}, {
		"component": "Colorpicker",
		"name": "textColor",
		"type": "string",
		"default": "#000000",
		"config": {
			"title": "Text color",
			"desc": "Specifies the text color for tags"
		}
	}, {
		"component": "Colorpicker",
		"name": "hoverColor",
		"type": "string",
		"default": "#C0C0C0",
		"config": {
			"title": "Hover color",
			"desc": "Specifies the hover color for tags"
		}
	}, {
		"component": "Colorpicker",
		"name": "backgroundColor",
		"type": "string",
		"default": "#D8D8D8",
		"config": {
			"title": "Background color",
			"desc": "Specifies the background color for tags"
		}
	}, {
		"component": "Slider",
		"name": "maxTagsCount",
		"type": "number",
		"default": 15,
		"config": {
			"title": "Maximum tag count",
			"desc": "Specifies maximum amount of tags to be displayed at any given time",
			"min": 5,
			"max": 30,
			"step": 1,
			"unit": "tags"
		}
	}, {
		"component": "Input",
		"name": "maxWidth",
		"type": "number",
		"default": 500,
		"config": {
			"title": "Maximum width",
			"desc": "Specify a maximum width (in pixels) of an App container",
			"data": {"sample": 500}
		}
	}]
}, {
	"component": "Group",
	"name": "dependencies",
	"type": "object",
	"config": {
		"title": "Dependencies",
		"expanded": false
	},
	"items": [{
		"component": "Select",
		"name": "appkey",
		"type": "string",
		"config": {
			"title": "StreamServer application key",
			"desc": "Specifies the application key for this instance",
			"options": []
		}
	}]
}, {
	"name": "targetURL",
	"component": "Echo.DataServer.Controls.Dashboard.DataSourceGroup",
	"type": "string",
	"required": true,
	"config": {
		"title": "",
		"expanded": false,
		"labels": {
			"dataserverBundleName": "Echo Tag Cloud Auto-Generated Bundle for {instanceName}"
		},
		"apiBaseURLs": {
			"DataServer": "{%= apiBaseURLs.DataServer %}/"
		}
	}
}];

dashboard.modifiers = {
	"dependencies.appkey": {
		"endpoint": "customer/{self:user.getCustomerId}/appkeys",
		"processor": function() {
			return this.getAppkey.apply(this, arguments);
		}
	},
	"targetURL": {
		"endpoint": "customer/{self:user.getCustomerId}/subscriptions",
		"processor": function() {
			return this.getBundleTargetURL.apply(this, arguments);
		}
	}
};

dashboard.init = function() {
	this.parent();
};

Echo.AppServer.Dashboard.create(dashboard);

})(Echo.jQuery);
