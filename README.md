# SmartInput
```javascript
var smartInput = new SmartInput({
    element: "#textInput",
    dropClass: "input-drop",
    filterImage: filterImageFunction,
    allowDropFiles: true,
    disabled: false
});
```

* `options`:`Object` - настройки компонента
* `[options.element]`:`Element|string` - Элемент. Можно указать в виде селектора. Если не указано, будет создан новый элемент
* `[options.dropClass]`:`string` - Класс, применяемый при попытке перетащить файл. По умолчанию - `"smart-input-drop-target"`
* `[options.filterImage]`:`Function` - Функция, позволяет фильтровать изображения внутри редактируемого элемента.\
по умолчанию все картинки удаляются из поля ввода. Если `filterImage(img:Element)` вернет `true`, картинка останется.
* `[options.allowDropFiles]`:`boolean` - разрешить перетаскивание файлов. По умолчанию - true.
* `[options.disabled]`:`boolean` - Отключить элемент. По умолчанию - зависит от наличия атрибута contenteditable
* `return`:`SmartInput`

## Методы

#### SmartInput.on(eventType, handler)
```javascript
function onChangeHandler(text){
    console.log("New value:", text);
}
smartInput.on("change", onChangeHandler);
```
Подписка на событие.

* `eventType`:`string` - тип события
* `handler`:`Function` - обработчик события
* `return`:`SmartInput`

#### SmartInput.off(eventType, handler)
```javascript
smartInput.off("change", onChangeHandler);
```
Отписка от события

* `eventType`:`string` - тип события
* `[handler]`:`Function` - обработчик события. Если не указан, 
                         отписка произойдет от всех событий данного типа
* `return`:`SmartInput`

#### SmartInput.emit(eventType, ...values)
```javascript
smartInput.emit("inputFile", new File(["text"], "foo.txt"));
```
Принудительная отправка события

* `eventType`:`string` - тип события
* `...values`:`Function` - агрументы, передаваемые обработчику события
* `return`:`SmartInput`
                           
#### SmartInput.onHotkey(hotkeyDescriptor, handler)
```javascript
smartInput.onHotkey({key: 13, ctrl:false, alt:false, shift:true, meta:false}, function(event){
    console.log(this.value);
    this.value = "";
});
```
Подписка событие нажатия горячих клавиш

* `hotkeyDescriptor`:`Object` - описание комбинации клавиш
* `hotkeyDescriptor.key`:`number` - код клавиши
* `[hotkeyDescriptor.ctrl]`:`boolean` - модификатор ctrl
* `[hotkeyDescriptor.alt]`:`boolean` модификатор alt
* `[hotkeyDescriptor.shift]`:`boolean` модификатор shift
* `[hotkeyDescriptor.meta]`:`boolean` модификатор meta\
Если какой-либо модификатор не указан или указан как null, 
событие будет обрабатываться при любом значении модификатора
* `handler`:`Function` - обработчик события. Принимает `event`:`KeyboardEvent`, `this`:`SmartInput`
* `return`:`SmartInput`
                          
#### SmartInput.offHotkey(hotkeyDescriptor, handler)
```javascript
smartInput.onHotkey({key: 13, ctrl:false, alt:false, shift:true, meta:false}, hotkeyHandler);
```
Отписка от события нажатия клавиш

* `hotkeyDescriptor`:`Object` - описание комбинации клавиш
* `hotkeyDescriptor.key`:`number` - код клавиши
* `[hotkeyDescriptor.ctrl]`:`boolean` - модификатор ctrl
* `[hotkeyDescriptor.alt]`:`boolean` модификатор alt
* `[hotkeyDescriptor.shift]`:`boolean` модификатор shift
* `[hotkeyDescriptor.meta]`:`boolean` модификатор meta
* `[handler]`:`Function` - обработчик события, ранее добавленный. Если не указан, 
                         отписка произойдет от всех событий по данной комбинации клавиш
* `return`:`SmartInput`

#### SmartInput.destroy()
```javascript
smartInput.destroy();
```
Используется, чтобы отключить все внутренние обработчики событий для этого компонента

## Свойства

#### value
```javascript
console.log( "Input value: ", smartInput.value );
smartInput.value += "text";
```
Текст, который отображается внутри элемента. Тип: `string`\
При инициализации вычисляется по содержимому элемента.

#### disabled
```javascript
console.log( "Input disabled: ", smartInput.disabled );
smartInput.disabled = !smartInput.disabled;
```
Доступен ли текст для редактирования. Тип: `boolean`\
При инициализации вычисляется по наличию атрибута `contenteditable="true"`.

#### placeholder
```javascript
console.log( "Input placeholder: ", smartInput.placeholder );
smartInput.placeholder = !smartInput.placeholder;
```
Задаёт элементу placeholder. Тип: `string`\
При инициализации вычисляется по значению атрибута `placeholder`.

#### element
```javascript
console.log( "Input element: ", smartInput.element );
```
Задаёт элементу placeholder. Тип: `Element`\
Доступен только для чтения.

## События

#### change
```javascript
smartInput.on("change", function(text){
    // ...
});
```
Событие вызывается при изменении текста внутри компонента

* `text`:`String` - новое значение
* `this`:`SmartInput`

#### inputFile
```javascript
smartInput.on("inputFile", function(file){
    // ...
});
```
Событие вызывается при передаче файла в компонент путём перетаскивания или вставки из буфера обмена

* `file`:`File|Blob` - передаваемый файл
* `this`:`SmartInput`

#### error
```javascript
smartInput.on("error", function(error){
    // ...
});
```
Вызывается при ошибке в любом из других обработчиков событий.

* `error`:`Error` - ошибка
* `...args`:`*` - сопутствующие параметры при ошибке.\
Обычно это название события обработчика и список его аргументов.

## Примечания

Safari - не работает вставка изображения из буфера обмена

IE10 и старше - не работает вставка изображения из буфера обмена

IE - обновление value и вызов события "change" происходит с небольшой задержкой, по событию keyup.

IE, Edge - необходимо скрывать placeholder средствами css, если он установлен в :before, в следующих случаях:\
-- наличие фокуса\
-- перетаскивание объекта в элемент