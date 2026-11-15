// Android: for Word, sdkjs checkViewMode keeps the hidden input writable under the View restriction (viewer mode),
// so the focus it keeps or gets back (asc_enableKeyEvents) shows the keyboard over the read-only document. Apply
// the rule sdkjs already has for presentations and spreadsheets; checkViewMode runs on every restriction change.
const viewerOnly = (api) => !!api && api.isRestrictionView() && !api.isRestrictionForms();

// Call once the document is ready: the text input lives in sdk-all.js, which loads after the API object exists.
export function patchAndroidViewerKeyboard() {
    const AC = window.AscCommon;
    if (!AC || !AC.CTextInput || !AC.AscBrowser || !AC.AscBrowser.isAndroid) return;
    const proto = AC.CTextInput.prototype;
    if (proto.__viewerKeyboardPatched || typeof proto.checkViewMode !== 'function' || typeof proto.setReadOnlyWrapper !== 'function') return;
    proto.__viewerKeyboardPatched = true;
    const checkViewMode = proto.checkViewMode;
    proto.checkViewMode = function () {
        if (!viewerOnly(this.Api)) return checkViewMode.apply(this, arguments);
        if (!this.isDisableKeyboard) {
            this.isDisableKeyboard = true;
            this.setReadOnlyWrapper(true);
        }
        if (this.HtmlArea && document.activeElement === this.HtmlArea)
            this.HtmlArea.blur();
    };
    // The document usually opens in viewer mode, before this patch exists.
    if (AC.g_inputContext) AC.g_inputContext.checkViewMode();
}
