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
var defaultDragClass = "smart-input-drag";

/**
 *
 * @param {Object|Function} [options]
 * @param {Element} [options.element]
 * @constructor
 */
function SmartInput(options){
    this.__eventHandlerMap = Object.create(null);
    this.__hotkeyHandlerDataMap = Object.create(null);
    this.__allowDropFiles = true;
    var smartInput = this;
    if (!options) options = {};
    if (typeof options === "function") {
        var constructConfig = Object.create(null);
        options = options.call(this, constructConfig);
        if (!options) options = constructConfig;
    }

    var dropClass = options && options.dropClass || defaultDropClass;
    var dragClass = options && options.dragClass || defaultDragClass;
    if ("allowDropFiles" in options && !options.allowDropFiles) this.__allowDropFiles = false;
    if ("disabled" in options) this.disabled = options.disabled;

    var element;
    if (typeof options.element === "string") {
        try {
            element = document.querySelector(options.element);
        } catch (ignored) {}
        if (!element) throw new Error("Wrong query selector: "+options.element);
    } else if (typeof options.element === "object") {
        element = options.element[0] || options.element;
    } else {
        (function(){
            var div = document.createElement("div");
            element.setAttribute("contenteditable", "true");
            return div;
        })()
    }

    this.__element = element;

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

    function updateEditorValue(){
        return smartInput.updateValue();
    }

    function onPaste(event){
        if (smartInput.disabled) return;
        var data = event.clipboardData || window.clipboardData;
        setTimeout(updateEditorValue, 0);
        setTimeout(removeStyles, 0);
        return onMediaEvent(event, data, true);
    }

    function onDrop(event){
        element.classList.remove(dragClass);
        element.classList.remove(dropClass);
        if (smartInput.disabled) return;
        var data = event.dataTransfer || window.dataTransfer;
        setTimeout(updateEditorValue, 0);
        setTimeout(removeStyles, 0);
        if (!smartInput.__allowDropFiles) return;
        return onMediaEvent(event, data, false);
    }

    function onDragover(event){
        if (smartInput.disabled) return false;
        if (!smartInput.__allowDropFiles) return true;
        var data = event.dataTransfer || window.dataTransfer;
        if (cbDataHasFiles(data)) cancelEvent(event);
    }

    function onDragenter(event){
        if (smartInput.disabled) return false;
        element.classList.add(dragClass);
        if (!smartInput.__allowDropFiles) return true;
        var data = event.dataTransfer;
        if (cbDataHasFiles(data)) {

            element.classList.add(dropClass);
        }
    }

    function onDragleave(event){
        if (event.target !== element) return;
        element.classList.remove(dragClass);
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

        if (editorAction) return filterText();
        return true;

        function filterText(){
             try {
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
        removeStyles();
        handleImages();
        smartInput.updateValue();
        fixSpaces();
    }

    function onKeyup(){
        if (smartInput.disabled) return;
        handleImages();
        smartInput.updateValue();
        fixSpaces();
        setTimeout(fixRangeOffset, 0);
    }

    function onKeydown(event){
        fixRangeOffset();
        var map = smartInput.__hotkeyHandlerDataMap;
        var handlerDataList = map[event.keyCode];
        if (!handlerDataList || handlerDataList.length === 0) return;
        var needCancelEvent = false;
        handlerDataList
            .filter(function(handlerData){
                var hotkey = handlerData.hotkey;
                if (!hotkey) return false;
                if (hotkey.ctrl != null && Boolean(event.ctrlKey) !== Boolean(hotkey.ctrl)) return false;
                if (hotkey.alt != null && Boolean(event.altKey) !== Boolean(hotkey.alt)) return false;
                if (hotkey.shift != null && Boolean(event.shiftKey) !== Boolean(hotkey.shift)) return false;
                if (hotkey.meta != null && Boolean(event.metaKey) !== Boolean(hotkey.meta)) return false;
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

    function removeStyles(){
        var nodeList = element.querySelectorAll("*[style],*[class]");
        if (!nodeList) return;
        Array.prototype.slice.call(nodeList).forEach(function(element){
            element.removeAttribute("style");
            element.removeAttribute("class");
        });
    }

    function handleImages(){
        var images = Array.prototype.slice.call(element.querySelectorAll('img'));
        var filterImage = options && options.filterImage;
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
        });
        Array.prototype.slice.call(element.querySelectorAll('svg,canvas')).forEach(function(image){
            var parentElement = image.parentElement;
            if (parentElement) parentElement.removeChild(image);
        });
    }

    function fixSpaces(){
        if (smartInput.__value) return fixSpacesExtraBr();
        var blockElements = element.querySelectorAll("div,p");
        if (blockElements.length > 0) return fixSpacesExtraBr();
        var brElements = element.querySelectorAll("br");
        if (brElements.length > 1) return fixSpacesExtraBr();
        return fixSpacesRemoveNodes();
    }

    function fixSpacesExtraBr(){
        addBrIfNeeded(element);
        var divs = Array.prototype.slice.call(element.querySelectorAll("div"));
        for(var i=0; i<divs.length; i++){
            addBrIfNeeded(divs[i]);
        }
    }

    function fixSpacesRemoveNodes(){
        var childNodes = Array.prototype.slice.call(element.childNodes);
        for (var j=0; j<childNodes.length; j++){
            var child = childNodes[j];
            element.removeChild(child);
        }
    }

    function fixRangeOffset(){ // в IE неправильно выставляется range, он встает после крайнего <BR>
        try { // условие плохого range: end находится в element, offset уходит на последний элемент
            var selection = window.getSelection();
            var range = selection.getRangeAt(0);
            if (range.endContainer !== element) return;
            var endOffset = range.endOffset;
            if (endOffset == 0) return;
            if (endOffset !== element.childNodes.length) return;
            // исключение - когда текст выделили полностью
            if (range.startContainer == element && range.startOffset == 0) return;
            range.setEnd(range.endContainer, endOffset-1);
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (ignored){}
    }

    this.__setText = function(text){
        clearDomElement(this.__element);
        textToStrongDOMList(text).forEach(function(div){
            this.__element.appendChild(div);
        }, this);
        this.updateValue();
        fixSpaces();
    };

    this.updateValue();

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
            if (this.__value == text) return;
            this.__setText(text);
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
    },

    allowDropFiles: {
        get: function(){
            return this.__allowDropFiles;
        },
        set: function (value) {
            this.__allowDropFiles = Boolean(value);
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
 *
 * @param text
 * @param {Object} [options]
 * @param {boolean} [options.deleteContents]
 * @param {boolean} [options.selectStart]
 * @param {boolean} [options.selectEnd]
 * @param {boolean} [options.scrollIntoViewIfNeeded]
 * @returns {SmartInput}
 */
SmartInput.prototype.insert = function insert(text, options) {
    if (!this.isInRange()) return this;
    var elements = textToSoftDOMList(text);
    if (!elements.length) return this;
    if (!options) options = {};
    try {
        var lastElement = elements[elements.length-1];
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        if (options.deleteContents) range.deleteContents();
        elements.reverse().forEach(function(node){
            range.insertNode( node );
        });
        if (options.selectEnd) {
            range.setEndAfter(lastElement);
            if (!options.selectStart) range.setStartAfter(lastElement);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        if (options.scrollIntoViewIfNeeded) scrollElement(lastElement);
        editor.updateValue();
    } catch (ignored){}
    return this;
};

function scrollElement(element){
    console.log("SCROLL", element, typeof element.scrollIntoViewIfNeeded === "function");
    if (typeof element.scrollIntoViewIfNeeded === "function") {
        element.scrollIntoViewIfNeeded(true);
    } else {
        scrollIntoViewIfNeeded.call(element, true)
    }
}

SmartInput.prototype.isInRange = function isInRange() {
    try {
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        if (!containsNodeUp(this.__element,range.startContainer)) return false;
        if (!containsNodeUp(this.__element,range.endContainer)) return false;
        return true;
    } catch (ignored){
        return false;
    }
};

function containsNodeUp(parent, child) {
    var node = child;
    while (node != null) {
        if (node == parent) {
            return true;
        }
        node = node.parentNode;
    }
    return false;
}

/**
 * @name SmartInput#updateValue
 * @returns {SmartInput}
 */
SmartInput.prototype.updateValue = function updateValue(){
    var value = readRichElement(this.__element);
    if (this.__value !== value) {
        this.__value = value;
        this.emit("change", value);
    }
    return this;
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
 * @param {boolean?} hotkeyConfig.meta
 * @param {Function} handler
 * @returns {SmartInput}
 */
SmartInput.prototype.onHotkey = function onHotkey(hotkeyConfig, handler){
    var hotkey = {
        key: hotkeyConfig.key,
        shift: hotkeyConfig.shift != null ? Boolean(hotkeyConfig.shift) : null,
        ctrl: hotkeyConfig.ctrl != null ? Boolean(hotkeyConfig.ctrl) : null,
        alt: hotkeyConfig.alt != null ? Boolean(hotkeyConfig.alt) : null,
        meta: hotkeyConfig.meta != null ? Boolean(hotkeyConfig.meta) : null
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
    if (Boolean(hotkey1.meta) !== Boolean(hotkey2.meta)) return false;
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
            handlerList.splice(i, 1);
        } else {
            i++;
        }
    }
    return this;
};

function cbDataHasFiles(data){
    var types = data.types && Array.prototype.slice.call(data.types);
    if (types && ~types.indexOf("Files")) return true;
    if (data.files && data.files.length) return true;
    if (data.items) {
        for (var i=0; i<data.items.length; i++){
            if (data.items[i].type === "file") return true;
        }
    }
    return false;
}

function cbDataGetFiles(data){
    if (data.files && data.files.length) {
        return Array.prototype.slice.call(data.files);
    } else if (data.items && data.items.length) {
        var items = Array.prototype.slice.call(data.items || []);
        var files = items && items
            .map(function(i){return i.getAsFile()})
            .filter(function(f){return f})
        ;
        if (files && files.length) return files;
    }
    return null;
}


/**
 * @param {string} text
 * @returns {Array<Element>}
 */
function textToStrongDOMList(text){
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
        })
    ;
}

/**
 * @param {string} text
 * @returns {Array<Element>}
 */
function textToSoftDOMList(text){
    return text
        .split('\n')
        .map(function(line){
            return line.replace(/^ /g,'\u00a0').replace(/ {2}/g,' \u00a0');
        })
        .reduce(function(resultArray, text){
            resultArray.push(document.createElement("BR"));
            if (text) resultArray.push(document.createTextNode(text));
            return resultArray;
        }, [])
        .slice(1)
    ;
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

function addBrIfNeeded(element){
    var childNodes = Array.prototype.slice.call(element.childNodes);
    var lastChild = childNodes[childNodes.length - 1];
    var isElement = lastChild.nodeType === Node.ELEMENT_NODE;
    var isBR = isElement && lastChild.tagName === "BR";
    var isDiv = isElement && lastChild.tagName === "DIV";
    if (isBR || isDiv) return; // если <BR> уже есть - ничего делать не нужно
    var brElement = document.createElement("BR");
    brElement.setAttribute("type", "auto");
    element.appendChild(brElement);
}

function scrollIntoViewIfNeeded(centerIfNeeded) {
    function withinBounds(value, min, max, extent) {
        if (false === centerIfNeeded || max <= value + extent && value <= min + extent) {
            return Math.min(max, Math.max(min, value));
        } else {
            return (min + max) / 2;
        }
    }

    function makeArea(left, top, width, height) {
        return  { "left": left, "top": top, "width": width, "height": height
            , "right": left + width, "bottom": top + height
            , "translate":
                function (x, y) {
                    return makeArea(x + left, y + top, width, height);
                }
            , "relativeFromTo":
                function (lhs, rhs) {
                    var newLeft = left, newTop = top;
                    lhs = lhs.offsetParent;
                    rhs = rhs.offsetParent;
                    if (lhs === rhs) {
                        return area;
                    }
                    for (; lhs; lhs = lhs.offsetParent) {
                        newLeft += lhs.offsetLeft + lhs.clientLeft;
                        newTop += lhs.offsetTop + lhs.clientTop;
                    }
                    for (; rhs; rhs = rhs.offsetParent) {
                        newLeft -= rhs.offsetLeft + rhs.clientLeft;
                        newTop -= rhs.offsetTop + rhs.clientTop;
                    }
                    return makeArea(newLeft, newTop, width, height);
                }
        };
    }

    var parent, elem = this, area = makeArea(
        this.offsetLeft, this.offsetTop,
        this.offsetWidth, this.offsetHeight);
    while ((parent = elem.parentNode) instanceof HTMLElement) {
        var clientLeft = parent.offsetLeft + parent.clientLeft;
        var clientTop = parent.offsetTop + parent.clientTop;

        // Make area relative to parent's client area.
        area = area.
        relativeFromTo(elem, parent).
        translate(-clientLeft, -clientTop);

        parent.scrollLeft = withinBounds(
            parent.scrollLeft,
            area.right - parent.clientWidth, area.left,
            parent.clientWidth);

        parent.scrollTop = withinBounds(
            parent.scrollTop,
            area.bottom - parent.clientHeight, area.top,
            parent.clientHeight);

        // Determine actual scroll amount by reading back scroll properties.
        area = area.translate(clientLeft - parent.scrollLeft,
            clientTop - parent.scrollTop);
        elem = parent;
    }
}
return SmartInput;
}));
