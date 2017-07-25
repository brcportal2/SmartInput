;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.SmartInput = factory();
  }
}(this, function() {
var defaultDropClass = "smart-input-drop-target";

/**
 *
 * @param {Object|Function} [config]
 * @param {Element} [config.element]
 * @constructor
 */
function SmartInput(config){
    this.__eventHandlerMap = Object.create(null);
    this.__hotkeyHandlerDataMap = Object.create(null);
    var smartInput = this;
    if (!config) config = {};
    if (typeof config === "function") {
        var constructConfig = Object.create(null);
        config = config.call(this, constructConfig);
        if (!config) config = constructConfig;
    }

    var dropClass = config && config.dropClass || defaultDropClass;

    var element = this.__element = config.element || (function(){
        var div = document.createElement("div");
        element.setAttribute("contenteditable", "true");
        return div;
    })();

    updateValue();

    element.addEventListener("paste", onPaste);
    element.addEventListener("keydown", onKeydown);
    element.addEventListener("keyup", onKeyup);
    element.addEventListener("input", onInput);
    element.addEventListener("drop", onDrop);
    element.addEventListener("dragover", onDragover);
    element.addEventListener("dragenter", onDragenter);
    element.addEventListener("dragleave", onDragleave);

    this.__removeEventListeners = function(){
        element.removeEventListener("paste", onPaste);
        element.removeEventListener("keydown", onKeydown);
        element.removeEventListener("keyup", onKeyup);
        element.removeEventListener("input", onInput);
        element.removeEventListener("drop", onDrop);
        element.removeEventListener("dragover", onDragover);
        element.removeEventListener("dragenter", onDragenter);
        element.removeEventListener("dragleave", onDragleave);
        smartInput.__removeEventListeners = null;
    };

    // config.filterFileDrag;


    function onPaste(event){
        if (smartInput.disabled) return;
        var data = event.clipboardData || window.clipboardData;
        setTimeout(updateValue, 0);
        return onMediaEvent(event, data, true);
    }

    function onDrop(event){
        element.classList.remove(config.dropClass || defaultDropClass);
        if (smartInput.disabled) return;
        var data = event.dataTransfer || window.dataTransfer;
        setTimeout(updateValue, 0);
        return onMediaEvent(event, data, false);
    }

    function onDragover(event){
        if (smartInput.disabled) return false;
        var data = event.dataTransfer || window.dataTransfer;
        var imageFiles = cbDataGetFiles(data);
        if (!imageFiles) cancelEvent(event);
    }

    function onDragenter(event){
        if (smartInput.disabled) return false;
        var data = event.dataTransfer;
        var types = data && data.types && Array.prototype.slice.call(data.types);
        if (types && ~types.indexOf("Files")) {
            element.classList.add(dropClass);
        }
    }

    function onDragleave(event){
        if (event.target !== element) return;
        element.classList.remove(dropClass);
    }

    function onMediaEvent(event, data, editorAction){
        var types = data && data.types && Array.prototype.slice.call(data.types);

        if (!types /*IE11*/ || ~types.indexOf("Files") /* modern browser */ ) {
            var imageFiles = cbDataGetFiles(data);
            if (imageFiles !== null) {
                imageFiles.forEach(function(file){
                    smartInput.emit("inputFile", file);
                });
                return cancelEvent(event);
            }
            return filterText();
        }

        if (types.length === 0) return true; // unsupported data type

        if (types.length===1 && types[0] === "text/html") return true; // FF paste image as data-url

        return filterText();

        function filterText(){
            if (editorAction) try {
                var textData = data.getData("text/plain");
                if (textData) {
                    document.execCommand("insertText", false, textData);
                    return cancelEvent(event);
                }
            } catch (ignored) {}
            return true;
        }
    }

    function onInput(){
        if (smartInput.disabled) return;
        handleImages();
        updateValue();
        fixEmptySpaces();
    }

    function onKeyup(){
        if (smartInput.disabled) return;
        handleImages();
        updateValue();
        fixEmptySpaces();
    }

    function onKeydown(event){
        var map = smartInput.__hotkeyHandlerDataMap;
        var handlerDataList = map[event.keyCode];
        if (!handlerDataList || handlerDataList.length === 0) return;
        var needCancelEvent = false;
        handlerDataList
            .filter(function(handlerData){
                var hotkey = handlerData.hotkey;
                if (!hotkey) return false;
                if (hotkey.ctrl != null && Boolean(event.ctrlKey) !== Boolean(handlerData.ctrl)) return false;
                if (hotkey.alt != null && Boolean(event.altKey) !== Boolean(handlerData.alt)) return false;
                if (hotkey.shift != null && Boolean(event.shiftKey) !== Boolean(handlerData.shift)) return false;
                return true;
            })
            .forEach(function(handlerData){
                try {
                    var handler = handlerData.handler;
                    var result = handler.call(smartInput, event);
                    if (result === false) needCancelEvent = true;
                } catch (error) {
                    smartInput.emit("error", error, handlerData.hotkey, event);
                }
            })
        ;
        return !needCancelEvent;
    }

    function handleImages(){
        var images = Array.prototype.slice.call(element.querySelectorAll('img'));
        var filterImage = config && config.filterImage;
        if (typeof filterImage === "function") images = images.filter(function(image){
            try {
                return ! filterImage(image)
            } catch(error){
                return true;
            }
        });
        images.forEach(function(image){
            var src = image.getAttribute("src");
            if (src.indexOf("data:") === 0) {
                var blob = dataURLtoBlob(src);
                smartInput.emit("inputFile", blob);
            }
            var parentElement = image.parentElement;
            if (parentElement) parentElement.removeChild(image);
        })
    }

    function updateValue(){
        var value = readRichElement(element);
        if (smartInput.__value !== value) {
            smartInput.__value = value;
            smartInput.emit("change", value);
        }
    }

    function fixEmptySpaces(){
        if (smartInput.__value) return;
        var childNodes = Array.prototype.slice.call(element.childNodes);
        for (var i=0; i<childNodes.length; i++){
            var child = childNodes[i];
            if (child.nodeType === Node.TEXT_NODE && !child.nodeValue) continue;
            element.removeChild(child);
        }
        if (childNodes.length === 0) element.appendChild(document.createTextNode(""));
    }

    this.__updateText = function(){
        clearDomElement(this.__element);
        textToDOMList(this.__value).forEach(function(div){
            this.__element.appendChild(div);
        }, this);
        fixEmptySpaces();
    };

}

Object.defineProperties(SmartInput.prototype, {

    element: {
        /**
         * @property
         * @name SmartInput#element
         * @type Element
         * @readonly
         */
        get: function(){
            return this.__element;
        }
    },

    value: {
        /**
         * @property
         * @name SmartInput#value
         * @type string|undefined
         */
        get: function(){
            if (!this.__element) return;
            return this.__value;
        },
        set: function(text){
            if (!this.__element) return;
            if (this.__value === text) return;
            this.__value = text;
            this.__updateText();
        }
    },

    placeholder: {
        get: function(){
            if (!this.__element) return null;
            return this.__element.getAttribute("placeholder");
        },

        set: function(value){
            if (!this.__element) return;
            this.__element.setAttribute("placeholder", value);
        }
    },

    disabled: {
        /**
         * @property
         * @name SmartInput#disabled
         * @type boolean|undefined
         */
        get: function(){
            if (!this.__element) return undefined;
            return !this.__element.getAttribute("contenteditable")
        },
        set: function(value){
            if (value) this.__element.removeAttribute("contenteditable");
            else this.__element.setAttribute("contenteditable", "true");
        }
    }
});

/**
 * @name SmartInput#remove
 * @returns {boolean}
 */
SmartInput.prototype.destroy = function destroy(){
    if (this.__removeEventListeners) this.__removeEventListeners();
    if (!this.__element) return false;
    this.__element = null;
    return true;
};

/**
 * @name SmartInput#on
 * @param {string} eventName
 * @param {Function} handler
 * @returns {SmartInput}
 */
SmartInput.prototype.on = function on(eventName, handler){
    var map = this.__eventHandlerMap;
    var handlerList = map[eventName] = map[eventName] || [];
    handlerList.push(handler);
    return this;
};

/**
 * @name SmartInput#off
 * @param {string} eventName
 * @param {Function} handler
 * @returns {SmartInput}
 */
SmartInput.prototype.off = function off(eventName, handler){
    var map = this.__eventHandlerMap;
    if (arguments.length === 1) {
        delete map[eventName];
        return this;
    }
    var handlerList = map[eventName] = map[eventName] || [];
    var index = handlerList.lastIndexOf(handler);
    handlerList.splice(index, 1);
    if (!handlerList.length) delete map[eventName];
    return this;
};

/**
 * @name SmartInput#emit
 * @param {string} eventName
 * @param {*} arguments
 * @returns {SmartInput}
 */
SmartInput.prototype.emit = function emit(eventName){
    var map = this.__eventHandlerMap;
    var handlerList = map[eventName];
    if (!handlerList || handlerList.length === 0) return this;
    var eventArgs = [];
    for (var i=1; i<arguments.length; i++) eventArgs.push(arguments[i]);
    handlerList.forEach(function(handler){
        try {
            handler.apply(this, eventArgs);
        } catch (error) {
            if (eventName !== "error") this.emit("error", error, eventName, eventArgs);
        }
    }, this);
    return this;
};

/**
 * @name SmartInput#onHotkey
 * @param {Object} hotkeyConfig
 * @param {number} hotkeyConfig.key
 * @param {boolean?} hotkeyConfig.ctrl
 * @param {boolean?} hotkeyConfig.shift
 * @param {boolean?} hotkeyConfig.alt
 * @param {Function} handler
 * @returns {SmartInput}
 */
SmartInput.prototype.onHotkey = function onHotkey(hotkeyConfig, handler){
    var hotkey = {
        key: hotkeyConfig.key,
        shift: hotkeyConfig.shift != null ? Boolean(hotkeyConfig.shift) : null,
        ctrl: hotkeyConfig.ctrl != null ? Boolean(hotkeyConfig.ctrl) : null,
        alt: hotkeyConfig.alt != null ? Boolean(hotkeyConfig.alt) : null
    };
    var map = this.__hotkeyHandlerDataMap;
    var handlerList = map[Number(hotkey.key)] = map[Number(hotkey.key)] || [];
    handlerList.push({hotkey:hotkey, handler:handler});
    return this;
};

function isSameHotkey(hotkey1, hotkey2){
    if (hotkey1 === hotkey2) return true;

    if (!hotkey1 || !hotkey2) return false;
    if (Number(hotkey1.key) !== Number(hotkey2.key)) return false;
    if (Boolean(hotkey1.ctrl) !== Boolean(hotkey2.ctrl)) return false;
    if (Boolean(hotkey1.alt) !== Boolean(hotkey2.alt)) return false;
    if (Boolean(hotkey1.shift) !== Boolean(hotkey2.shift)) return false;
    return true;
}

/**
 * @name SmartInput#off
 * @param {Object} hotkey
 * @param {number} hotkey.key
 * @param {boolean?} hotkey.ctrl
 * @param {boolean?} hotkey.shift
 * @param {boolean?} hotkey.alt
 * @param {Function} handler
 * @returns {SmartInput}
 */
SmartInput.prototype.offHotkey = function offHotkey(hotkey, handler){
    var map = this.__hotkeyHandlerDataMap;
    if (arguments.length === 1) {
        delete map[Number(hotkey.key)];
        return this;
    }
    var i=0;
    var handlerList = map[Number(hotkey.key)] = map[Number(hotkey.key)] || [];
    while (i < handlerList.length) {
        var handlerData = handlerList[i];
        var handlerHotkey = handlerData.hotkey;
        if (isSameHotkey(hotkey, handlerHotkey)) {
            handlerHotkey.splice(i, 1);
        } else {
            i++;
        }
    }
    return this;
};


function cbDataIsPublic(clipboardData){
    if (!clipboardData.types) return false;
    for (var i=0; i<clipboardData.types.length; i++) {
        if (clipboardData.types[i].indexOf('public') === 0) return true;
    }
    return false;
}

function cbDataGetFiles(clipboardData){
    if (clipboardData.files && clipboardData.files.length) {
        return Array.prototype.slice.call(clipboardData.files);
    } else if (clipboardData.items && clipboardData.items.length) {
        var items = Array.prototype.slice.call(clipboardData.items || []);
        return items.map(function(i){return i.getAsFile()});
    } else {
        return null;
    }
}


/**
 * @param {string} text
 * @returns {Array<Element>}
 */
function textToDOMList(text){
    return text
        .split('\n')
        .map(function(line){
            var div = document.createElement('div');
            if (line) {
                var spacedLine = line.replace(/^ /g,'\u00a0').replace(/ {2}/g,' \u00a0');
                div.appendChild(document.createTextNode(spacedLine));
            } else {
                div.appendChild(document.createElement('br'));
            }
            return div;
        });
}

/**
 * @param {Element} element
 * @returns {Element}
 */
function clearDomElement(element){
    var child;
    while (child = element.lastChild) {
        element.removeChild(child);
    }
    return element;
}

/**
 * @param {Event} event
 * @returns {boolean} false
 */
function cancelEvent(event) {
    event = event || window.event;
    if (!event) return false;
    event.stopPropagation && event.stopPropagation();
    event.preventDefault && event.preventDefault();
    event.returnValue = false;
    event.cancelBubble = true;
    return false;
}

/**
 * magic
 */
function readRichElement(element) {

    var textLines = [], textValues = [];
    read(element);
    return textLines.join("\n").replace(/\u00A0/g, ' ');

    function flushTextLine(){
        var textLine = textValues.join("");
        textLine = textLine.replace(/\r\n/g,'\n').replace(/\r+/g,' ');
        textLines.push(textLine);
        textValues = [];
    }

    function read(element){

        if (element.nodeType === Node.TEXT_NODE) {
            var value = element.nodeValue;
            if (!value) return;
            textValues.push(value);
            return;
        }

        if (element.nodeType === Node.ELEMENT_NODE) {
            var isBlockElement = false;
            if (element.tagName === "BR"){
                return flushTextLine();
            }
            if (element.tagName === "IMG"){
                element.alt && textValues.push(element.alt);
                return;
            }
            if (element.tagName === "DIV" || element.tagName === "P") isBlockElement = true;
            if (isBlockElement && textValues.length) {
                flushTextLine();
            }
            if (isBlockElement && !element.firstChild && !textValues.length) {
                textLines.push("");
                return;
            }
            for (var i = element.firstChild; i; ) {
                read(i);
                i = i.nextSibling;
            }
            if (isBlockElement && textValues.length) {
                flushTextLine();
            }
        }
    }
}


/**
 * @param {string} dataUrl
 * @returns {Blob}
 */
function dataURLtoBlob(dataUrl) {
    var arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        a = atob(arr[1]), n = a.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = a.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}
return SmartInput;
}));
