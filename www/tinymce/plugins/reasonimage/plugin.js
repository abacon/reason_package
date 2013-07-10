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
  * @param Object controlSelectors The items to which the the picker will be bound
  * @param String targetPanelSelector The item to which the the picker will be bound
  * @param String type 'image' or 'link'; determines which plugin to use
  **/
reasonPlugins = function (controlSelectors, targetPanelSelector, type) {
  var currentReasonPlugin;

  if (type === "image") {
    currentReasonPlugin = new reasonPlugins.reasonImage(controlSelectors, targetPanelSelector);
    //TODO: caching here?
  }
  else if (type === "link") {
    currentReasonPlugin = '';
  }
};

/**
 * jsonURL handles url and query string building for json requests.
 * For example, jsonURL(15, 6, 'image') should return a URL for the sixteenth
 * to the twenty-second images of the list.
 *
 * @param Integer offset     the index of the first item to fetch
 * @param Integer chunk_size the number of items to fetch
 * @param String  type       the type of items to fetch, i.e. image or link
 */
  reasonPlugins.jsonURL = function (offset, chunk_size, type) {
    var site_id = tinymce.activeEditor.settings.reason_site_id,
        reason_http_base_path = tinymce.activeEditor.settings.reason_http_base_path;

    return reason_http_base_path + 'displayers/generate_json.php?site_id=' + site_id + '&type=' + type + '&num=' + chunk_size + '&offset=' + offset + '&';
  };

  /**
   * Returns the tinyMCE control object for a given tinymce control name.
   *
   * @param String selector the 'name' value of a tinymce control
   **/
  reasonPlugins.getControl = function (selector) {
    return tinymce.activeEditor.windowManager.windows[0].find('#' + selector)[0];
  };

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
    this.chunk_size = 1000;
    this.page_size = 5;
    this.page = 1;
    this.srcControl = reasonPlugins.getControl(controlSelectors.src);
    this.altControls = tinymce.map(controlSelectors.alt, function(item) {
      return reasonPlugins.getControl(item);
    });
    this.alignControls = tinymce.map(controlSelectors.align, function(item) {
      return reasonPlugins.getControl(item);
    });
    this.sizeControl = reasonPlugins.getControl(controlSelectors.size);
    this.targetPanel = reasonPlugins.getControl(placeholderSelector);
    this.type = "image";
    this.json_url = reasonPlugins.jsonURL;
    this.items = [];

    this.insertReasonUI();
    this.bindReasonUI();
    this.renderReasonImages();
  };



  /**
   * Prepends the reason controls to the tinyMCE panel specified by
   * this.targetPanel.
   *
   * TODO: Make this a tinymce control of type panel and settings.html
   **/
  reasonPlugins.reasonImage.prototype.insertReasonUI = function() {
    var holderDiv;
    this.UI = this.targetPanel.getEl();
    var css = 'button:disabled, button:disabled:hover, button:disabled:focus, button[disabled=true] { background-image: linear-gradient(to bottom, rgb(222, 222, 222), rgb(184, 184, 184)) !important; color: #aaaaaa; } .items_chunk { text-align: center; height: 300px; overflow-y: scroll; white-space: normal;} .image_item {width: 190px; padding: 5px; display: inline-block;} .items_chunk .name, .items_chunk .description {display: block; white-space: normal;} .items_chunk .description {font-size: 0.9em;}' ,
    head = document.getElementsByTagName('head')[0],
    style = document.createElement('style');

    style.type = 'text/css';
    if (style.styleSheet){
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }

    head.appendChild(style);
    // I should probably be using documentFragments here. Eh.
    holderDiv = document.createElement("div");
    // TODO this makes me incredibly sad.
    var search = '<div style="margin-left: 20px; margin-top: 20px; width: 660px; height: 30px;" class="mce-container-body mce-abs-layout"><div id="mce_51-absend" class="mce-abs-end"></div><label style="line-height: 18px; left: 0px; top: 6px; width: 122px; height: 18px;" id="mce_52" class="mce-widget mce-label mce-first mce-abs-layout-item">Search:</label><input style="left: 122px; top: 0px; width: 528px; height: 28px;" id="searchyThing" class="reasonImageSearch mce-textbox mce-last mce-abs-layout-item" value="" hidefocus="true" size="40"></div>';
    holderDiv.innerHTML = '<div class="reasonImage">' + search + '<button class="mce-btn prevImagePage" type="button">Previous</button><button class="mce-btn nextImagePage">Next</button><div class="items_chunk"> </div></div>';

    this.UI.insertBefore(holderDiv.firstChild, this.UI.firstChild);

  };

  /**
   * Binds various controls like cancel, next page, and search to their
   * corresponding functions.
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
      var begin, end;

      end = ((self.page - 1) * self.page_size);
      begin = end - self.page_size;

      self.page -= 1;
      self.display_images(self.displayedItems.slice(begin, end));
    });

    tinymce.DOM.bind(this.nextButton, 'click', function(e) {
      var begin, end;

      begin = (self.page * self.page_size);
      end = (begin + self.page_size);

      self.page += 1;
      self.display_images(self.displayedItems.slice(begin, end));
    });

    this.sizeControl.on('select', function (e) {
      self.setImageSize(self.sizeControl.value());
    });

    // TODO This could be a little nicer...
    // TODO I don't think binding both to the selectImage is needed if this is here, too...
    this.altControls[0].on('change', function(e) {self.altControls[1].value(self.altControls[0].value()); });
    this.altControls[1].on('change', function(e) {self.altControls[0].value(self.altControls[1].value()); });

    this.alignControls[0].on('select', function(e) {
      self.alignControls[1].value(e.control.value());
    });
    this.alignControls[1].on('select', function(e) {
      self.alignControls[0].value(e.control.value());
    });

    tinymce.DOM.bind(this.searchBox, 'keyup', function(e) {
      var target = e.target || window.event.srcElement;
      reasonPlugins.delay(function() {
        if (target.value) {
          self.result = self.findImagesWithText(target.value);
          self.displayedItems = self.result;
          self.display_images();
        } else {
          self.displayedItems = self.items;
          self.display_images();
        }
      }, 200);
    });
  };

  /**
   * Searches this.items for ReasonImageDialogItems that contain a search
   * term in their keywords, title, or description.
   * @param String q The string to look for in items
   * @return Array an array of matching ReasonImageDialogItems
   **/
  reasonPlugins.reasonImage.prototype.findImagesWithText = function (q) {
    var result = [];
    var list = this.items;
    var regex = new RegExp(q, "i");
    for (var i in list) {
      if (list.hasOwnProperty(i)) {
        if (list[i].hasText(regex)) {
          result.push(list[i]);
        }
      }
    }
    return result;
  };

  /**
   * Links reason controls (selecting an image, writing alt text) to hidden
   * tinyMCE elements.
   * @param HTMLDivElement image_item the div that contains the image
   */
  reasonPlugins.reasonImage.prototype.selectImage = function (image_item) {
    var src = image_item.getElementsByTagName('IMG')[0].src;
    if (!!this.imageSize && this.imageSize == 'full')
      src = src.replace("_tn", "_orig");
    this.srcControl.value(src);
    tinymce.each(this.altControls, function(v, i) {v.value(image_item.getElementsByClassName('name')[0].innerHTML);});
  };

  reasonPlugins.reasonImage.prototype.setImageSize = function (size) {
    this.imageSize = size;
    if (this.srcControl.value() && this.srcControl.value().search("_tn.jpg") != -1) {
      this.srcControl.value(this.srcControl.value().replace("_tn", "_orig"));
    }
  };

  // TODO: Right now you can click past the last page and some weirdness happens.
  reasonPlugins.reasonImage.prototype.renderReasonImages = function () {
      this.fetch_images(1, function() {
        this.displayedItems = this.items;
        this.display_images();
    });
  };

  /**
   * Renders an array of ReasonImageDialogItems to
   * this.imagesListBox.innerHTML. If there is no array provided,
   * renders the first page of result from the current context (images or
   * search results).
   * @param Array images_array
   **/
  reasonPlugins.reasonImage.prototype.display_images = function (images_array) {
    var imagesHTML = "";

    images_array = (!images_array && this.displayedItems) ? this.displayedItems.slice(0, this.page_size) : images_array;

    for (var i in images_array) {
      i = images_array[i];
      imagesHTML += i.display_item();
    }

    this.imagesListBox.innerHTML = imagesHTML;
    this.update_pagination();
  };

  /**
   * Handles enabling/disabling of "Next Page"/"Previous Page" buttons.
   * Should be called after every new chunk is loaded, page is displayed,
   * or search result is calculated.
   **/
  reasonPlugins.reasonImage.prototype.update_pagination = function() {
    var num_of_pages = Math.ceil(this.displayedItems.length/this.page_size);
    this.nextButton.disabled = (this.page + 1 > num_of_pages);
    this.prevButton.disabled = (this.page - 1 <= 0);
  }

  /**
   * Given a response, constructs ReasonImageDialogItems and pushes
   * each one onto the this.items array.
   * @param String response the JSON string that contains the items
   **/
  reasonPlugins.reasonImage.prototype.parse_images = function(response) {
    var parsed_response = JSON.parse(response), response_items = parsed_response.items;

    this.totalItems = parsed_response.count;

    for (var i in response_items) {
      item = new ReasonImageDialogItem();
      item.name = response_items[i].name;
      item.id = response_items[i].id;
      item.description = response_items[i].description;
      item.pubDate = response_items[i].pubDate;
      item.lastMod = response_items[i].lastMod;
      item.URLs = {'thumbnail': response_items[i].thumbnail, 'full': response_items[i].link};
      this.items.push(item);
    }
  };

  /**
   * Fetches all of the images that belong to or are borrowed from a site,
   * via ajax as a series of chunks of size this.chunk_size, and executes
   * a callback after the first chunk finishes downloading.
   * @param Number   chunk    the number of the chunk to get. Used for calculating 
   *                          offset.
   * @param Function callback a function to be executed when the chunk has finished
   *                          being downloaded and parsed.
   **/
  reasonPlugins.reasonImage.prototype.fetch_images = function (chunk, callback) {

    if (!this.json_url)
      throw "You need to set a URL for the dialog to fetch JSON from.";

    var offset = ((chunk - 1) * this.chunk_size), url;

    if (typeof this.json_url === 'function')
      {
        url = this.json_url(offset, this.chunk_size, this.type);
      } else
        url = this.json_url;

      tinymce.util.XHR.send({
        "url": url,
        "success": function(response) {
          this.parse_images(response, chunk);
          callback.call(this);
          if (chunk+1 <= this.totalItems/this.chunk_size)
            this.fetch_images(chunk+1, function() {});
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
  };

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
          title: "existing image",
          name: "reasonImagePanel",
          type: "form",
          minWidth: "700",
          minHeight: "500",
          items: [
            {name: 'alt_2', type: 'textbox', size: 40, label: 'Description'},
            // TODO: This needs a default value or something. tinymce displays the top item
            //       but doesn't count it as selected.
            {name: 'size', type: 'listbox', label: "Size", values: [
              {text: 'Thumbnail', value: 'thumb'},
              {text: 'Full', value: 'full'}
            ]},
            {name: 'align_2', type: 'listbox', label: "Align", values: [
              {text: 'None', value: 'none'},
              {text: 'Left', value: 'left'},
              {text: 'Right', value: 'right'}
            ]}
          ],
          onchange: function(e) {console.log(!!e.target? e.target.value: e);}
        },

        // Add from the Web
        {
            title: "from a web address",
            type: "form",
            items: [{
                name: 'src',
                type: 'textbox',
                filetype: 'image',
                size: 40,
                autofocus: true,
                label: 'URL'
            }, {
                name: 'alt',
                type: 'textbox',
                size: 40,
                label: 'Description'
            }, {
              name: 'align', type: 'listbox', label: "Align", values: [
                {text: 'None', value: 'none'},
                {text: 'Left', value: 'left'},
                {text: 'Right', value: 'right'}
              ]
            }]
        }

        ],
        bodyType: 'tabpanel',
        onPostRender: function(e) {
          target_panel = 'reasonImagePanel';
          controls_to_bind = {
            src: 'src',
            alt: ['alt', 'alt_2'],
            align: ['align', 'align_2'],
            size: 'size'
          };
          reasonPlugins(controls_to_bind, target_panel,  'image', e);
        },
        onSubmit: function(e) {
          var data = win.toJSON();
          if (!data.src)
            return;

          if (data.align == "none")
            delete data.align;

          if (imgElm) {
            dom.setAttribs(imgElm, data);
          } else {
            editor.insertContent(dom.createHTML('img', data));
          }
        }
      });
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
