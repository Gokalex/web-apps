// Paste from the context menu. A menu tap fires no paste event, so read the system clipboard when the browser
// allows it (iOS asks the user with a "Paste" button; the Android WebView usually refuses) and paste it the way
// sdkjs pastes a paste event, otherwise paste what was last copied in this document.
// Resolves 'clipboard', 'document' (only this document's last copy was available) or false (nothing to paste).
// readClipboard: null when the clipboard cannot be read, {} when it holds no text (an image, for example).

const normalize = (text) => (text || '').replace(/\r\n?/g, '\n');

async function readClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.read) return null;
    try {
        const [item] = await navigator.clipboard.read();
        const data = {};
        if (!item) return data;
        for (const type of ['text/html', 'text/plain']) {
            if (item.types.includes(type)) data[type] = await (await item.getType(type)).text();
        }
        return data;
    } catch (e) {
        return null;
    }
}

function lastCopyText(cb) {
    const text = (cb.LastCopyBinary || []).find((d) => d.type === AscCommon.c_oAscClipboardDataFormat.Text);
    return text ? text.data : null;
}

// Same order and steps as the HTML and text branches of sdkjs _private_onpaste.
function pasteData(api, cb, data) {
    if (api.isLongAction()) return;
    AscCommon.g_specialPasteHelper.specialPasteData.images = null;
    cb.PasteFlag = true;
    api.incrementCounterLongAction();
    cb.pastedFrom = null;
    try {
        let html = data['text/html'];
        if (html) {
            const end = html.indexOf('</html>');
            if (end !== -1) html = html.substring(0, end + '</html>'.length);
            cb.CommonIframe_PasteStart(html, data['text/plain'] || '');
            return;
        }
        api.asc_PasteData(AscCommon.c_oAscClipboardDataFormat.Text, data['text/plain']);
    } catch (e) {
        console.warn('mekko paste:', e);
    }
    cb.Paste_End();
}

// A copy that never reached the system clipboard is the newest one until the user leaves the editor (where they
// may copy something else).
let copyMissedClipboard = false, leftSinceCopy = false;
document.addEventListener('visibilitychange', () => { if (document.hidden) leftSinceCopy = true; });

// Records whether the last menu Copy/Cut reached the system clipboard; returns its argument.
export function noteMenuCopy(reachedClipboard) {
    copyMissedClipboard = !reachedClipboard;
    leftSinceCopy = false;
    return reachedClipboard;
}

export async function pasteFromMenu(api) {
    const cb = AscCommon.g_clipboardBase;
    if (!cb || cb.IsWorking()) return 'clipboard';
    if (cb.LastCopyBinary && !leftSinceCopy && (copyMissedClipboard || !cb.isCopyOutEnabled())) {
        api.Paste();
        return 'document';
    }
    const data = await readClipboard();
    if (data && !data['text/html'] && !data['text/plain']) return false;
    const last = lastCopyText(cb);
    // Copied in this document: the internal copy keeps everything the HTML would lose.
    if (data && !(last !== null && normalize(data['text/plain']) === normalize(last))) {
        pasteData(api, cb, data);
        return 'clipboard';
    }
    if (!cb.LastCopyBinary) return false;
    api.Paste();
    return data ? 'clipboard' : 'document';
}
