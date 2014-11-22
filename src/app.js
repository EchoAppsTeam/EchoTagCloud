(function($) {
"use strict";

var tagcloud = Echo.App.manifest("Echo.Apps.TagCloud");

if (Echo.App.isDefined(tagcloud)) return;

tagcloud.vars = {
	"tags": [],   // list of tags currently displayed on a page
	"tagById": {} // object for fast Tag objects access
};

tagcloud.config = {
	"targetURL": undefined,
	// amount of items to retrieve from StreamServer
	// 100 is the limitation on the amount of root items
	"maxItemsToRetrieve": 100,
	// "cloud" lib config handle
	"cloud": {},
	"presentation": {
		"maxWidth": 500, // in px
		"minWidth": 250, // in px
		"maxTagsCount": 15,    // max amount of tags to be displayed
		"visualization": "3D", // or 2D
		"skin": "tag",         // or "block", "text"
                "hoverColor": "#C0C0C0",
		"textColor": "#000000",
		"backgroundColor": "#D8D8D8",
		"tagMaxLength": 15
	},
	"dependencies": {
		"StreamServer": {
			"appkey": undefined,
			"apiBaseURL": "{%= apiBaseURLs.StreamServer.basic %}/",
			"liveUpdates": {
				"transport": "websockets",
				"enabled": true,
				"websockets": {
					"URL": "{%= apiBaseURLs.StreamServer.ws %}/"
				}
			}
		}
	}
};

tagcloud.dependencies = [{
	"url": "{config:cdnBaseURL.sdk}/api.pack.js",
	"control": "Echo.StreamServer.API"
}, {
	"url": "{%= appBaseURLs.prod %}/third-party/jquery.tags-cloud.min.js",
	"loaded": function() { return !!$.fn.cloud; }
}];

tagcloud.labels = {
	"noTags": "No data yet.<br>Stay tuned!"
};

tagcloud.init = function() {
	var app = this;

	// check for "targetURL" field, without
	// this field we are unable to retrieve any data
	if (!this.config.get("targetURL")) {
		this.showMessage({
			"type": "error",
			"message": "Unable to retrieve data, target URL is not specified."
		});
		return;
	}

	// attach unique CSS class for this app instance
	// to target this instance in CSS selectors later
	var uniqueCSSClass = this.cssPrefix + this.config.get("context");
	this.set("uniqueCSSClass", uniqueCSSClass);
	app.config.get("target").addClass(uniqueCSSClass);

	app._requestData({
		"onData": function(data, options) {
			var allTags = app._extractTags(data);
			app.set("tagById", allTags);
			app.set("tags", app._selectPopularTags(allTags));
			app._maybeSupplyEmptyTags();
			app._applyDynamicSkinCSS();
			app.render();
			app.ready();
		},
		"onUpdate": function(data) {
			var tags = app._extractTags(data);
			$.each(tags, function(i, data) {
				var tag = app.tagById[data.title];
				if (tag) {
					tag.count += data.count;
				} else {
					app.tagById[data.title] = data;
				}
				if (!tag || !tag.visible) {
					app._appendTag(data);
				}
			});
		},
		"onError": function(data, options) {
			var isCriticalError =
				typeof options.critical === "undefined" ||
				options.critical && options.requestType === "initial";

			if (isCriticalError) {
				app.showError(data, $.extend(options, {
					"request": app.request
				}));
			}
		}
	});
};

tagcloud.methods.template = function() {
	var hasTags = !!this._getNonEmptyTags().length;
	return this.templates[hasTags ? "tags" : "empty"];
};

tagcloud.templates.tags =
	'<div class="{class:container} skin-{config:presentation.skin}">' +
		'<div class="{class:tags}"></div>' +
		'<div class="echo-clear"></div>' +
	'</div>';

tagcloud.templates.empty =
	'<div class="{class:empty}">' +
		'<span class="{class:message}">{label:noTags}</span>' +
	'</div>';

tagcloud.renderers.container = function(element) {
	var presentation = this.config.get("presentation");

	// 3D visualization is taking extra space for items
	// to rotate, so we take that into account and reduce max width
	var margin = presentation.visualization === "3D" ? 100 : 0;

	// make sure we do not go lower than min width
	var maxWidth = Math.max(presentation.minWidth, presentation.maxWidth);

	element.css({"max-width": (maxWidth - margin) + "px"});
	element.addClass(this.cssPrefix + presentation.visualization + "-mode");
	return element;
};

tagcloud.renderers.tags = function(element) {
	var app = this;
	var tags = this.get("tags");

	element.empty()
		.hide()
		.addClass(this.cssPrefix + "skin-" + this.config.get("presentation.skin"))
		.append($.map(tags, $.proxy(app._renderTag, app)));

	if (this.config.get("presentation.visualization") === "3D") {
		var config = {"hwratio": 0.5};
		// decrease the fog if we have less than 5 tags
		if (this._getNonEmptyTags().length < 5) {
			config.fog = 0.01;
		}
		// make sure that elements that represent tags
		// are already in the DOM tree, so that the lib
		// can calculate the necessary element positions as needed
		setTimeout(function() {
			element.cloud($.extend(config, app.config.get("cloud"))).show();
		}, 0);
	} else {
		element.show();
	}

	return element;
};

tagcloud.methods._renderTag = function(tag) {
	var maxLength = this.config.get("presentation.tagMaxLength");
	var isTooLong = tag.title.length > maxLength;
	tag.element = $(this.substitute({
		"template": '<div class="{class:tag}"{data:hint}>{data:title}</div>',
		"data": {
			"hint": isTooLong ? ' title="' + tag.title + '"' : "",
			"title": isTooLong ? tag.title.substr(0, maxLength) + "..." : tag.title
		}
	}));
	return tag.empty ? tag.element.hide() : tag.element;
};

tagcloud.methods._assembleQuery = function() {
	var query = "childrenof:{config:targetURL} " +
		"itemsPerPage:{config:maxItemsToRetrieve} children:0";
	return this.substitute({"template": query});
};

tagcloud.methods._extractTags = function(data) {
	if (!data || !data.entries || !data.entries.length) return {};
	return Echo.Utils.foldl({}, data.entries, function(entry, acc) {
		var tags = entry.object.tags;
		if (tags && tags.length) {
			$.each(tags, function(i, tag) {
				if (acc[tag]) {
					acc[tag].count++;
				} else {
					acc[tag] = {"count": 1, "title": tag};
				}
			});
		}
	});
};

tagcloud.methods._selectPopularTags = function(tags) {
	var maxTags = this.config.get("presentation.maxTagsCount");
	var tagsArray = $.map(tags, function(tag) { return tag; });
	return tagsArray.sort(function(a, b) {
		return b.count > a.count ? 1 : (b.count < a.count ? -1 : 0);
	}).slice(0, maxTags);
};

tagcloud.methods._maybeSupplyEmptyTags = function() {
	// supply empty cells to leverage them later when live updates come in
	var tagsCount = this.get("tags").length;
	var maxTags = this.config.get("presentation.maxTagsCount");

	if (maxTags <= tagsCount) return;

	for (var i = 0; i < maxTags - tagsCount; i++) {
		this.get("tags").push({"count": 0, "title": "", "empty": true});
	}
};

tagcloud.methods._appendTag = function(tag) {
	var app = this;
	var tags = this.get("tags");
	var isFirstTag = this._getNonEmptyTags().length === 0;
	var target;

	$.each(tags, function(i, data) {
		if (data.empty || data.count < tag.count) {
			target = {"index": i, "tag": data};
			return false; // break
		}
	});

	if (target) {
		target.tag.visible = false;
		tag.element = target.tag.element;
		tags.splice(target.index, 1, tag);
		app.set("tags", tags);
		if (isFirstTag) {
			// rerender the whole app
			// to switch templates (empty -> tags)
			app.render();
		}
		tag.element.text(tag.title).show();
		tag.visible = true;
	}
};

tagcloud.methods._getNonEmptyTags = function() {
	return $.grep(this.get("tags"), function(tag) { return !tag.empty; });
};

tagcloud.methods._requestData = function(handlers) {
	var ssConfig = this.config.get("dependencies.StreamServer");
	// keep a reference to a request object in "this" to trigger its
	// automatic sweeping out on Echo.Control level at app destory time
	this.request = Echo.StreamServer.API.request({
		"endpoint": "search",
		"apiBaseURL": ssConfig.apiBaseURL,
		"data": {
			"q": this._assembleQuery(),
			"appkey": ssConfig.appkey
		},
		"liveUpdates": $.extend(ssConfig.liveUpdates, {
			"onData": handlers.onUpdate
		}),
		"onError": handlers.onError,
		"onData": handlers.onData
	});
	this.request.send();
};

tagcloud.methods._applyDynamicSkinCSS = function() {
	var css = this.substitute({
		"template": this._tagSkinCSS() + this._blockSkinCSS() + this._textSkinCSS()
	});
	Echo.Utils.addCSS(css, this.config.get("context"));
};

tagcloud.methods._tagSkinCSS = function() {
	return '.{self:uniqueCSSClass} .skin-tag .{class:tag} { position: relative; float: left; margin: 5px 8px 5px 18px; height: 36px; line-height: 36px; font-size: 18px; padding: 0 10px 0 18px; background: {config:presentation.backgroundColor}; color: {config:presentation.textColor}; text-decoration: none; -moz-border-radius-bottomright: 4px; -webkit-border-bottom-right-radius: 4px; border-bottom-right-radius: 4px; -moz-border-radius-topright: 4px; -webkit-border-top-right-radius: 4px; border-top-right-radius: 4px; }' +
	'.{self:uniqueCSSClass} .skin-tag .{class:tag}:before { content: ""; float: left; position: absolute; top: 0; left: -18px; width: 0; height: 0; border-color: transparent {config:presentation.backgroundColor} transparent transparent; border-style: solid; border-width: 18px 18px 18px 1px; }' +
	'.{self:uniqueCSSClass} .skin-tag .{class:tag}:after { content: ""; position: absolute; top: 16px; left: 0; float: left; width: 4px; height: 4px; -moz-border-radius: 2px; -webkit-border-radius: 2px; border-radius: 2px; background: {config:presentation.textColor}; -moz-box-shadow: -1px -1px 2px {config:presentation.textColor}; -webkit-box-shadow: -1px -1px 2px {config:presentation.textColor}; box-shadow: -1px -1px 2px {config:presentation.textColor}; }' +
	'.{self:uniqueCSSClass} .skin-tag .{class:tag}:hover { background: {config:presentation.hoverColor}; }' +
	'.{self:uniqueCSSClass} .skin-tag .{class:tag}:hover:before { border-color: transparent {config:presentation.hoverColor} transparent transparent; }';
};

tagcloud.methods._blockSkinCSS = function() {
	return '.{self:uniqueCSSClass} .skin-block .{class:tag} { float: left; margin: 5px; height: 36px; line-height: 36px; font-size: 18px; padding: 0 18px 0 18px; background: {config:presentation.backgroundColor}; color: {config:presentation.textColor}; -moz-border-radius: 4px; -webkit-border-radius: 4px; border-radius: 4px; }' +
	'.{self:uniqueCSSClass} .skin-block .{class:tag}:hover { background: {config:presentation.hoverColor}; }';
};

tagcloud.methods._textSkinCSS = function() {
	return '.{self:uniqueCSSClass} .skin-text .{class:tag} { float: left; color: {config:presentation.textColor}; margin: 3px 0px; height: 24px; line-height: 24px; font-size: 16px; padding: 0 10px; -moz-border-radius: 4px; -webkit-border-radius: 4px; border-radius: 4px; }' +
	'.{self:uniqueCSSClass} .skin-text .{class:tag}:hover { background: {config:presentation.hoverColor}; }'; 
};

tagcloud.css =
	// 3D visualization is not centered :(
	// so we have to push it left a bit to prevent
	// items from falling out of a target container
	'.{class:3D-mode} .{class:tags} { margin-left: -60px; }' +
	'.{class:tags} { clear: both; width: 100%; }' +
	'.{class:container} { margin: 0px auto; }' +
	'.{class:empty} { text-align: center; background-color: #fff; border: 1px solid #d2d2d2; margin: 0 5px 10px 5px; padding: 30px 0; }' +
	'.{class:empty} .{class:message} { text-align: left; background: url("//cdn.echoenabled.com/apps/echo/conversations/v2/sdk-derived/images/info.png") no-repeat; margin: 0 auto; font-size: 14px; font-family: "Helvetica Neue", Helvetica, "Open Sans", sans-serif; padding-left: 40px; display: inline-block; line-height: 16px; color: #7f7f7f; }' +
	'.{class:tag} { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; font-family: "Helvetica Neue", Helvetica, "Open Sans", sans-serif; }';

Echo.App.create(tagcloud);

})(Echo.jQuery);
