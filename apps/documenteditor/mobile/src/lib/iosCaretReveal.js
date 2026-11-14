// iOS Safari: the on-screen keyboard covers the editor iframe without resizing it, and a cross-origin iframe cannot
// read the host's visualViewport, so the engine believes the whole canvas is visible and leaves the caret under
// the keyboard. After each edit, scroll so the caret sits above an estimated keyboard top.
const KEYBOARD_SHARE_PORTRAIT = 0.40;   // of the long screen side
const KEYBOARD_SHARE_LANDSCAPE = 0.55;  // of the short screen side
const KEYBOARD_MIN = 300;               // keyboard plus predictive bar on the smallest iPhones
const MARGIN = 24;

// Height api.js in the host page keeps the iframe at on iPhone (it ends at the keyboard); null when not fitted.
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
    const long = Math.max(screen.width, screen.height);
    const short = Math.min(screen.width, screen.height);
    const landscape = screen.orientation ? screen.orientation.type.startsWith('landscape')
        : window.matchMedia('(orientation: landscape)').matches;
    const keyboard = landscape ? short * KEYBOARD_SHARE_LANDSCAPE : Math.max(long * KEYBOARD_SHARE_PORTRAIT, KEYBOARD_MIN);
    return window.innerHeight - keyboard;
}

function revealCaret(input) {
    const area = input.HtmlArea;
    const target = document.getElementById(input.TargetId);
    const wc = input.Api && input.Api.WordControl;
    const scroll = wc && wc.m_oScrollVerApi;
    const rv = window.__rv = { n: ((window.__rv && window.__rv.n) || 0) + 1, why: '' };   // TEMPORARY diag
    if (!area || !target || !scroll) { rv.why = 'noel'; return; }
    if (document.activeElement !== area || area.contentEditable !== 'true') { rv.why = 'nofocus'; return; }
    const doc = wc.m_oLogicDocument;
    if (doc && doc.IsSelectionUse && doc.IsSelectionUse()) { rv.why = 'sel'; return; }   // no caret while text is selected
    const overflow = target.getBoundingClientRect().bottom - (visibleBottom() - MARGIN);
    rv.why = 'ok'; rv.ov = Math.round(overflow); rv.vb = Math.round(visibleBottom()); rv.s0 = Math.round(scroll.scrollVCurrentY);
    if (overflow > 0) scroll.scrollByY(overflow);
    rv.s1 = Math.round(scroll.scrollVCurrentY);
}

function watch(input) {
    const area = input.HtmlArea;
    if (!area) return;
    window.__rvWatch = (window.__rvWatch || 0) + 1; window.__rvArea = area;   // TEMPORARY diag
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
    area.addEventListener('input', () => later(150));
    area.addEventListener('keyup', () => later(150));
    area.addEventListener('focus', () => later(400));
}

// Call once the document is ready: the text input lives in sdk-all.js, which loads after the API object exists.
export function patchIosCaretReveal() {
    const AC = window.AscCommon;
    if (!AC || !AC.CTextInput || !AC.AscBrowser || !AC.AscBrowser.isSafariMobile) return;
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
