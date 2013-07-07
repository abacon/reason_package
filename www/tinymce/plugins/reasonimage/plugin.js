/**
 * ReasonImage and ReasonLink plugins
 *
 * These plugins integrate tinyMCE into the Reason CMS.
 * ReasonImage allows a user to insert an image that belongs
 * to a Reason Site
 */

/*global tinymce:true */


 /**
  * ReasonPlugins is a container and dispatch for ReasonImage and ReasonLink.
  *
  * It has some basic configuration, and then rest is done in the constituent
  * functions.
  *
  * Executes the correct plugin for the given filebrowser field type.
  * TODO: json_generator should take the unique name of the type, not the type ID.
  * TODO: We need to account for having multiple editors per page. I think that maybe
  *       we should cache a reference to the current editor's plugin and check if activeEditor
  *       is the same as the last time reasonPlugins was called?
  *
  * @param String linkSelector The item to which the the picker will be bound
  * @param String targetPanelSelector The item to which the the picker will be bound
  * @param String type 'image' or 'link'; determines which plugin to use
  **/
reasonPlugins = function(controlSelectors, targetPanelSelector, type) {
  var currentReasonPlugin;

  if (type === "image") {
    currentReasonPlugin = new reasonPlugins.reasonImage(controlSelectors, targetPanelSelector);
    //TODO: caching here?
  }
  else if (type === "link")
    currentReasonPlugin = '';
};

  /**
   * jsonURL handles url and query string building for json requests.
   * For example, jsonURL(15, 6) should return a URL for the sixteenth
   * to the twenty-second items of the list.
   */
  reasonPlugins.jsonURL = function (offset, chunk_size) {
    var self = this;
    var site_id = tinymce.activeEditor.settings.reason_site_id;
    if (self.type === "image")
      typeId = 243;
    else if (self.type === "link")
      typeId = "???";

    return '/reason/displayers/generate_json.php?site_id=' + site_id + '&type=image&num=' + chunk_size + '&offset=' + offset + '&';
  };

  reasonPlugins.getControl = function (selector) {
    return tinymce.activeEditor.windowManager.windows[0].find('#'+selector)[0];
  }

  /**
   * Gets a reference to tinyMCE's representation of the panel that holds the filePicker.
   * This code is pretty fragile, but could be improved to be more robust.
   * The fundamental consideration re: fragility is: "What is my containing element?" or,
   * more specifically, "Where do I want to put the ReasonPlugin controls?"
   * @param string selector the selector for the file browser control
   **/
  reasonPlugins.getPanel = function (control) {
    // TODO: We can keep going up until we find a parent of type panel to make this a little more robust.
    return control.parent().parent();
  };

  // From SO: http://stackoverflow.com/questions/1909441/jquery-keyup-delay
  reasonPlugins.delay = (function(){
    var timer = 0;
    return function(callback, ms){
      clearTimeout (timer);
      timer = setTimeout(callback, ms);
    };
  })();


  /** 
   * Dispatch function. Gets a reference to the panel, and does everything we
   * need to do in order to get the plugin up and running.
   */
  reasonPlugins.reasonImage = function(controlSelectors, placeholderSelector) {
    this.chunk_size = 6;
    this.srcControl = reasonPlugins.getControl(controlSelectors.src);
    this.altControl = reasonPlugins.getControl(controlSelectors.alt);
    this.sizeControl = reasonPlugins.getControl(controlSelectors.size);
    this.targetPanel = reasonPlugins.getControl(placeholderSelector);
    this.json_url = reasonPlugins.jsonURL;
    this.items = [];

    this.insertReasonUI();
    this.bindReasonUI();
    this.renderReasonImages();
  };



  /**
   * Prepends the reason controls to the tinyMCE panel.
   **/
  reasonPlugins.reasonImage.prototype.insertReasonUI = function() {
    var holderDiv;
    this.UI = this.targetPanel.getEl();

    // I should probably be using documentFragments here. Eh.
    holderDiv = document.createElement("div");
    // TODO this makes me incredibly sad.
    var search = '<div style="margin-left: 20px; margin-top: 20px; width: 660px; height: 30px;" class="mce-container-body mce-abs-layout"><div id="mce_51-absend" class="mce-abs-end"></div><label style="line-height: 18px; left: 0px; top: 6px; width: 122px; height: 18px;" id="mce_52" class="mce-widget mce-label mce-first mce-abs-layout-item">Search:</label><input style="left: 122px; top: 0px; width: 528px; height: 28px;" id="searchyThing" class="reasonImageSearch mce-textbox mce-last mce-abs-layout-item" value="" hidefocus="true" size="40"></div>';
    holderDiv.innerHTML = '<div class="reasonImage">' + search + '<button class="mce-btn prevImagePage" type="button">Previous</button><button class="mce-btn nextImagePage">Next</button><div class="items_chunk"> </div></div>';

    this.UI.insertBefore(holderDiv.firstChild, this.UI.firstChild);

  };

  /**
   * Binds various controls like cancel, next page, and search to their 
   * corresponding functions. Genius.
   **/
  reasonPlugins.reasonImage.prototype.bindReasonUI = function() {
    var self = this;

    this.reasonImageControls = this.UI.getElementsByClassName('reasonImage')[0];
    this.imagesListBox = this.UI.getElementsByClassName('items_chunk')[0];
    this.CancelButton = this.UI.getElementsByClassName('cancelReasonImage')[0];
    this.prevButton = this.UI.getElementsByClassName('prevImagePage')[0];
    this.nextButton = this.UI.getElementsByClassName('nextImagePage')[0];
    this.searchBox = this.UI.getElementsByClassName('reasonImageSearch')[0];

    // Maybe I should move these bindings elsewhere for better coherence?
    tinymce.DOM.bind(this.imagesListBox, 'click', function(e) {
      var target = e.target || window.event.srcElement;
      if (target.nodeName == 'A' && target.className == 'image_item')
        self.selectImage( target );
      else if (target.nodeName == 'IMG' || (target.nodeName == 'SPAN' && (target.className == 'name' || target.className == 'description')))
        self.selectImage( target.parentElement );
    });

    tinymce.DOM.bind(this.prevButton, 'click', function(e) {
      self.renderReasonImages(self.page - 1 || 1);
    });

    tinymce.DOM.bind(this.nextButton, 'click', function(e) {
      self.renderReasonImages(self.page + 1);
    });

    this.sizeControl.on('select', function (e) {
      self.setImageSize(self.sizeControl.value());
    });

    tinymce.DOM.bind(this.searchBox, 'keyup', function(e) {
      var target = e.target || window.event.srcElement;
      reasonPlugins.delay(function() {
        if (!target.value) {
          self.renderReasonImages(1);
          return;
        }
        self.results = self.findImagesWithText(target.value);
        self.display_images(self.results);
      }, 200);
    });
  };

  reasonPlugins.reasonImage.prototype.findImagesWithText = function (q) {
    var result = [];
    var list = this.items;
    var regex = new RegExp(q, "i");
    for (var i in list) {
      if (list.hasOwnProperty(i)) {
        for (var j in list[i]) {
          if (list[i][j].hasText(regex)) {
            result.push(list[i][j]);
          }
        }
      }
    }
    return result;
  }

  /**
   * Links reason controls (selecting an image, writing alt text) to hidden
   * tinyMCE elements.
   * TODO: add alt tag things.
   */
  reasonPlugins.reasonImage.prototype.selectImage = function (image_item) {
    var src = image_item.getElementsByTagName('IMG')[0].src;
    if (!!this.imageSize && this.imageSize == 'full')
      src = src.replace("_tn", "_orig");
    this.srcControl.value(src);
    this.altControl.value(image_item.getElementsByClassName('name')[0].innerHTML);
  };

  reasonPlugins.reasonImage.prototype.setImageSize = function (size) {
    this.imageSize = size;
    if (this.srcControl.value() && this.srcControl.value().search("_tn.jpg") != -1) {
      this.srcControl.value(this.srcControl.value().replace("_tn", "_orig"));
    }
  }

  // TODO: Right now you can click past the last page and some weirdness happens.
  reasonPlugins.reasonImage.prototype.renderReasonImages = function (page) {
    page = !page ? 1 : page;
    this.page = page;
    if (typeof this.items[page] !== 'undefined') {
      this.display_images(this.items[page]);
    } else {
      this.fetch_images(page, function() {
        this.display_images(this.items[page]);
      });
    }

  };

  reasonPlugins.reasonImage.prototype.display_images = function (images_array) {
    var imagesHTML = "";

    for (var i in images_array) {
      i = images_array[i];
      imagesHTML += i.display_item();
    }

    this.imagesListBox.innerHTML = imagesHTML;
  };

  reasonPlugins.reasonImage.prototype.parse_images = function(response, page) {
    var parsed_response = JSON.parse(response), response_items = parsed_response['items'];
    var items_to_add = [];

    this.totalItems = parsed_response['count'];

    for (var i in response_items) {
      item = new ReasonImageDialogItem();
      item.name = response_items[i].name;
      item.id = response_items[i].id;
      item.description = response_items[i].description;
      item.pubDate = response_items[i].pubDate;
      item.lastMod = response_items[i].lastMod;
      item.URLs = {'thumbnail': response_items[i].thumbnail, 'full': response_items[i].link};
      items_to_add.push(item);
    }
    this.items[page] = items_to_add;
  };

  reasonPlugins.reasonImage.prototype.fetch_images = function (page, callback) {

    if (!this.json_url)
      throw "You need to set a URL for the dialog to fetch JSON from.";

    var offset = ((page - 1) * this.chunk_size);

    if (typeof this.json_url === 'function')
      {
        var url = this.json_url(offset, this.chunk_size);
      } else
        var url = this.json_url;

      tinymce.util.XHR.send({
        "url": url,
        "success": function(response) {
          this.parse_images(response, page);
          callback.call(this);
          if (page+1 <= this.totalItems/this.chunk_size)
            this.fetch_images(page+1, function() {});
        },
        "success_scope": this
      });
  };


  var ReasonImageDialogItem = function () {};
  ReasonImageDialogItem.prototype.escapeHtml = function (unsafe) {
    return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  };

  ReasonImageDialogItem.prototype.URLs = {
    thumbnail: '',
    full: ''
  };
  ReasonImageDialogItem.prototype.hasText = function(q) {
    if ((this.name.search(q) !== -1) || (this.description.search(q) !== -1)) {
      return this;
    }
  }

  ReasonImageDialogItem.prototype.description = '';


  ReasonImageDialogItem.prototype.render_item = function () {
    size = 'thumbnail';
    description = this.escapeHtml(this.description);
    return '<img ' +
      'src="' + this.URLs[size] +
      '" alt="' + description + '"></img>';
  };

  ReasonImageDialogItem.prototype.display_item = function () {
    return '<a id="reasonimage_' + this.id + '" class="image_item"><span class="name">' + this.escapeHtml(this.name) + '</span>' + this.render_item() + '<span class="description">' + this.escapeHtml(this.description) + '</span></a>';
  };


  reasonPlugins.reasonLink = function() {};



/**
 * This is the actual tinyMCE plugin. 
 */



tinymce.PluginManager.add('reasonimage', function(editor, url) {

	function showDialog() {
                var old_file_browser_callback = editor.settings.file_browser_callback;
                editor.settings.file_browser_callback = reasonPlugins;
		var win, data, dom = editor.dom, imgElm = editor.selection.getNode();
		var width, height;

		if (imgElm.nodeName == "IMG" && !imgElm.getAttribute('data-mce-object')) {
			data = {
				src: dom.getAttrib(imgElm, 'src'),
				alt: dom.getAttrib(imgElm, 'alt')
			};
		} else {
			imgElm = null;
		}

    win = editor.windowManager.open({
        title: 'Add an image',
        body: [
          // Add from Reason
          {
          title: "from reason",
          name: "reasonImagePanel",
          type: "form",
          //layout: "flex",
          minWidth: "700",
          minHeight: "500",
          items: [
            {name: 'alt_2', type: 'textbox', size: 40, label: 'Text to display'},
            // TODO: This needs a default value or something. tinymce displays the top item
            //       but doesn't count it as selected.
            {name: 'size', type: 'listbox', label: "Size", values: [
              {text: 'Thumbnail', value: 'thumb'},
              {text: 'Full', value: 'full'}
            ]}
          ],
          // You can also pass a function and have it executed, but you need to change
          // the type to "panel," I believe. 
          // html: somefunction,
          onchange: function(e) {console.log(!!e.target? e.target.value: e);}
        },

          // Add from the Web
          {
          title: "from a URL",
          type: "form",
          items: [
            {
            name: 'src',
            type: 'textbox',
            filetype: 'image',
            size: 40,
            autofocus: true,
            label: 'URL'
          },
          {name: 'alt', type: 'textbox', size: 40, label: 'Text to display'},
          // TODO: This isn't implemented in tinymce yet. When it is... !
          //{ title: "Size", type: "radiogroup", items: [
            //{type: 'radio', text: 'Thumbnail', value: 'poooo', tooltip: "Image will display as a thumbnail"},
            //{type: 'radio', text: 'Full', value: 'poooo', tooltip: "Image will display at full size"},
          //]}

          ]
        }

        ],
        bodyType: 'tabpanel',
        onPostRender: function(e) {
          target_panel = 'reasonImagePanel';
          controls_to_bind = {
            src: 'src',
            alt: 'alt',
            size: 'size',
          };
          reasonPlugins(controls_to_bind, target_panel,  'image', e);
        },
        onSubmit: function(e) {
          var data = win.toJSON();

          if (imgElm) {
            dom.setAttribs(imgElm, data);
          } else {
            editor.insertContent(dom.createHTML('img', data));
          }
        }
      });
        editor.settings.file_browser_callback = old_file_browser_callback;
	}

	editor.addButton('reasonimage', {
		icon: 'image',
		tooltip: 'Insert/edit image',
		onclick: showDialog,
		stateSelector: 'img:not([data-mce-object])'
	});

	editor.addMenuItem('reasonimage', {
		icon: 'image',
		text: 'Insert image',
		onclick: showDialog,
		context: 'insert',
		prependToContext: true
	});
});
