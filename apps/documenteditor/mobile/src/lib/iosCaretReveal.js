// iOS Safari: the on-screen keyboard covers the editor iframe without resizing it, and a cross-origin iframe cannot
// read the host's visualViewport, so the engine believes the whole canvas is visible and leaves the caret under
// the keyboard. While the hidden input has focus, keep the caret above an estimated keyboard top.
const KEYBOARD_SHARE_PORTRAIT = 0.40;   // of the long screen side
const KEYBOARD_SHARE_LANDSCAPE = 0.55;  // of the short screen side
const MARGIN = 24;

function keyboardTop() {
    const long = Math.max(screen.width, screen.height);
    const short = Math.min(screen.width, screen.height);
    const landscape = window.matchMedia && window.matchMedia('(orientation: landscape)').matches;
    const keyboard = landscape ? short * KEYBOARD_SHARE_LANDSCAPE : long * KEYBOARD_SHARE_PORTRAIT;
    return window.innerHeight - keyboard;
}

export function patchIosCaretReveal() {
    const AC = window.AscCommon;
    if (!AC || !AC.CTextInput || !AC.AscBrowser || !AC.AscBrowser.isSafariMobile) return;

    const proto = AC.CTextInput.prototype;
    if (proto.__mekkoCaretReveal) return;
    proto.__mekkoCaretReveal = true;

    let pending = false;
    const check = (input) => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            const area = input.HtmlArea;
            const target = document.getElementById(input.TargetId);
            const wc = window.Asc && Asc.editor && Asc.editor.WordControl;
            try {   // TEMP diagnostics for the iOS Simulator, numbers and flags only
                parent.postMessage({ mekkoDebug: {
                    area: !!area, target: !!target, wc: !!wc, scroll: !!(wc && wc.m_oScrollVerApi),
                    active: document.activeElement === area, ce: area && area.contentEditable,
                    caret: target && target.getBoundingClientRect().bottom, display: target && target.style.display,
                    limit: keyboardTop() - MARGIN, innerH: innerHeight, screenH: screen.height,
                } }, '*');
            } catch (e) { /* ignore */ }
            if (!area || !target || !wc || !wc.m_oScrollVerApi) return;
            if (document.activeElement !== area || area.contentEditable !== 'true') return;
            const caretBottom = target.getBoundingClientRect().bottom;
            const limit = keyboardTop() - MARGIN;
            if (caretBottom <= limit || target.style.display === 'none') return;
            wc.m_bIsUpdateTargetNoAttack = true;
            wc.m_oScrollVerApi.scrollByY(caretBottom - limit);
            wc.OnScroll();
        });
    };

    const move = proto.move;
    proto.move = function () {
        move.apply(this, arguments);
        check(this);
    };

    const init = proto.init;
    proto.init = function () {
        init.apply(this, arguments);
        const input = this;
        if (input.HtmlArea) {
            input.HtmlArea.addEventListener('focus', () => setTimeout(() => check(input), 400));
        }
    };
}
