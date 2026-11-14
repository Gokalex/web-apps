// iOS: sdkjs turns the keyboard's autocorrect and predictions off on its hidden input, and in the contenteditable
// used on iOS a typed space arrives as NBSP, which then stays in the document wherever the field is emptied.
// Turn autocorrect on and map NBSP to a normal space. Autocapitalize stays off: the field is emptied after every
// word, so iOS would capitalize the first word after every tap.
function enableKeyboardHelp(input) {
    const area = input.HtmlArea;
    if (!area) return;
    area.setAttribute('autocorrect', 'on');
    area.setAttribute('spellcheck', 'true');
    area.removeAttribute('autocomplete');
}

// Call once the document is ready: the text input lives in sdk-all.js, which loads after the API object exists.
export function patchIosKeyboardInput() {
    const AC = window.AscCommon;
    if (!AC || !AC.CTextInput || !AC.AscBrowser || !AC.AscBrowser.isSafariMobile) return;
    const proto = AC.CTextInput.prototype;
    if (proto.__keyboardInputPatched) return;
    proto.__keyboardInputPatched = true;
    const getAreaValue = proto.getAreaValue;
    proto.getAreaValue = function () {
        return getAreaValue.apply(this, arguments).replace(/\u00A0/g, ' ');
    };
    // sdkjs can create the input, or create it again, after document:ready: set the attributes in init too.
    const init = proto.init;
    proto.init = function () {
        init.apply(this, arguments);
        enableKeyboardHelp(this);
    };
    if (AC.g_inputContext) enableKeyboardHelp(AC.g_inputContext);
}
