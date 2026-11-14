// iOS Safari: the hidden contenteditable that receives typing covers the whole canvas, so its own caret sits at
// the top-left and WebKit never scrolls the real caret out from under the keyboard. Keep the hidden caret on the
// document caret (padding moves it without changing the touch area) so WebKit reveals it while typing.
export function patchIosCaretReveal() {
    const AC = window.AscCommon;
    if (!AC || !AC.CTextInput || !AC.AscBrowser || !AC.AscBrowser.isSafariMobile) return;

    const proto = AC.CTextInput.prototype;
    if (proto.__mekkoCaretReveal) return;
    proto.__mekkoCaretReveal = true;

    const move = proto.move;
    proto.move = function (x, y) {
        move.apply(this, arguments);
        const area = this.HtmlArea;
        const target = document.getElementById(this.TargetId);
        if (!area || area.tagName !== 'DIV' || !target) return;

        const height = parseInt(target.style.height, 10) || 16;
        const left = x != null ? x : parseInt(target.style.left, 10) || 0;
        const top = y != null ? y : parseInt(target.style.top, 10) || 0;
        const style = area.style;
        style.boxSizing = 'border-box';
        style.overflow = 'hidden';
        style.whiteSpace = 'pre';
        style.fontSize = height + 'px';
        style.lineHeight = height + 'px';
        style.paddingLeft = Math.max(0, left) + 'px';
        style.paddingTop = Math.max(0, top) + 'px';
    };
}
