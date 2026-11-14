// TEMPORARY: shows the iPhone keyboard layout numbers at the top of the editor. Remove after the measurements.
let box = null;
let hostHeight = '-';

window.addEventListener('message', (e) => {
    const d = e.data;
    if (e.source === window.parent && d && typeof d === 'object' && Object.prototype.hasOwnProperty.call(d, 'hostVisibleHeight'))
        hostHeight = d.hostVisibleHeight;
});

function draw() {
    try {
        const AC = window.AscCommon;
        const input = AC && AC.g_inputContext;
        const wc = input && input.Api && input.Api.WordControl;
        const sdk = document.getElementById('editor_sdk');
        const target = input && document.getElementById(input.TargetId);
        const sv = wc && wc.m_oScrollVerApi;
        const is = wc && wc.MobileTouchManager && wc.MobileTouchManager.iScroll;
        const r = Math.round;
        const t = target && target.getBoundingClientRect();
        box.textContent = [
            `host ${hostHeight} inner ${innerHeight} vv ${r(visualViewport.height)}`,
            `sdk ${sdk ? sdk.offsetHeight : '-'} eng ${wc ? wc.Height : '-'} kb ${input && document.activeElement === input.HtmlArea ? 'on' : 'off'}`,
            `caret ${t ? r(t.top) + '-' + r(t.bottom) : '-'}`,
            `sv ${sv ? r(sv.scrollVCurrentY) + '/' + r(sv.maxScrollY) : '-'} is ${is ? r(-is.y) + '/' + r(-is.maxScrollY) : '-'}`,
            `watch ${window.__rvWatch || 0} same ${input && window.__rvArea === input.HtmlArea ? 'y' : 'n'} rv ${JSON.stringify(window.__rv || {})}`,
        ].join('\n');
    } catch (err) {
        box.textContent = String(err);
    }
}

export function startLayoutDiag() {
    if (box) return;
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:4px;top:60px;z-index:100000;pointer-events:none;font:11px/1.3 monospace;'
        + 'white-space:pre;background:rgba(255,235,0,.9);color:#000;padding:3px 5px;border-radius:4px;';
    document.body.appendChild(box);
    setInterval(draw, 300);
    draw();
}
