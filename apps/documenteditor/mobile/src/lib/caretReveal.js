// Keep the caret above the on-screen keyboard while typing: sdkjs scrolls it only to the bottom edge of the canvas,
// and only on the next edit, so a caret tapped low on the screen stays under the keyboard that opens. iOS: the
// keyboard covers the frame, and a cross-origin iframe cannot read the host's visualViewport.
const KEYBOARD_SHARE_PORTRAIT = 0.40;   // of the long screen side
const KEYBOARD_SHARE_LANDSCAPE = 0.55;  // of the short screen side
const KEYBOARD_MIN = 300;               // keyboard plus predictive bar on the smallest iPhones
const MARGIN = 24;

// Height api.js in the host page keeps the iframe at (it ends at the keyboard); null when not fitted.
let hostVisibleHeight = null;
window.addEventListener('message', (e) => {
    const d = e.data;
    if (e.source !== window.parent || !d || typeof d !== 'object' || !Object.prototype.hasOwnProperty.call(d, 'hostVisibleHeight')) return;
    hostVisibleHeight = typeof d.hostVisibleHeight === 'number' && d.hostVisibleHeight > 0 ? d.hostVisibleHeight : null;
});

function visibleBottom() {
    if (hostVisibleHeight) return Math.min(hostVisibleHeight, window.innerHeight);
    const vv = window.visualViewport;
    if (vv && vv.height < window.innerHeight - 100) return vv.offsetTop + vv.height;   // viewport already shrinks
    if (window.AscCommon.AscBrowser.isAndroid) return window.innerHeight;   // the keyboard may be closed: no estimate
    const long = Math.max(screen.width, screen.height);
    const short = Math.min(screen.width, screen.height);
    const landscape = screen.orientation ? screen.orientation.type.startsWith('landscape')
        : window.matchMedia('(orientation: landscape)').matches;
    const keyboard = landscape ? short * KEYBOARD_SHARE_LANDSCAPE : Math.max(long * KEYBOARD_SHARE_PORTRAIT, KEYBOARD_MIN);
    return window.innerHeight - keyboard;
}

// iOS types into a contenteditable div, Android into a textarea (read-only in viewer mode).
const typing = (area) => document.activeElement === area
    && (area.tagName === 'TEXTAREA' ? !area.readOnly : area.contentEditable === 'true');

function revealCaret(input) {
    const area = input.HtmlArea;
    const target = document.getElementById(input.TargetId);
    const wc = input.Api && input.Api.WordControl;
    const scroll = wc && wc.m_oScrollVerApi;
    if (!area || !target || !scroll || !typing(area)) return;
    const doc = wc.m_oLogicDocument;
    if (doc && doc.IsSelectionUse && doc.IsSelectionUse()) return;   // no caret while text is selected
    const overflow = target.getBoundingClientRect().bottom - (visibleBottom() - MARGIN);
    if (overflow > 0) scroll.scrollByY(overflow);
}

function watch(input) {
    const area = input.HtmlArea;
    if (!area) return;
    let timer = 0, again = 0;
    // The engine moves the caret asynchronously (its own scroll waits 100 ms); Return and Backspace are handled
    // on keydown and fire no input event. Throttled, with one more check after the last event of a burst.
    const later = (delay) => {
        if (timer) { again = Math.max(again, delay); return; }
        timer = setTimeout(() => {
            timer = 0;
            revealCaret(input);
            if (again) { const next = again; again = 0; later(next); }
        }, delay);
    };
    // Android: the frame shrinks to end at the keyboard, also when it reopens on a tap while the input keeps the
    // focus; reveal only a caret the shrink covers, not one the user scrolled away from. No focus check there:
    // sdkjs refocuses the input after sheets with the keyboard down. iOS: the host fit shrinks the frame later.
    const android = window.AscCommon.AscBrowser.isAndroid;
    let focusedAt = 0, lastHeight = window.innerHeight;
    area.addEventListener('input', () => later(150));
    area.addEventListener('keyup', () => later(150));
    area.addEventListener('focus', () => { focusedAt = Date.now(); if (!android) later(400); });
    window.addEventListener('resize', () => {
        const before = lastHeight;
        lastHeight = window.innerHeight;
        if (lastHeight >= before) return;
        if (!android) {
            if (Date.now() - focusedAt < 2000) later(150);
            return;
        }
        const target = document.getElementById(input.TargetId);
        if (target && target.getBoundingClientRect().bottom <= before) later(150);
    });
}

// Call once the document is ready: the text input lives in sdk-all.js, which loads after the API object exists.
export function patchCaretReveal() {
    const AC = window.AscCommon;
    if (!AC || !AC.CTextInput || !AC.AscBrowser || !(AC.AscBrowser.isSafariMobile || AC.AscBrowser.isAndroid)) return;
    const proto = AC.CTextInput.prototype;
    if (proto.__caretRevealPatched) return;
    proto.__caretRevealPatched = true;
    const init = proto.init;
    proto.init = function () {
        init.apply(this, arguments);
        watch(this);
    };
    if (AC.g_inputContext) watch(AC.g_inputContext);
}
