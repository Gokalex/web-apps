// Phone photos are 12 MP or more (5-10 MB): the upload is slow on mobile data, and every such image costs about
// 50 MB of decoded memory in the editor, which phones run out of. Before sdkjs uploads an image, shrink photos
// larger than a printed page needs, and turn HEIC into JPEG (other browsers cannot show HEIC). Any failure uploads
// the original file.

const MAX_SIDE = 2560;
const MIN_BYTES = 256 * 1024;
const SHRINK_TIMEOUT = 20000;
const isJpeg = (file) => /^image\/jpeg$/.test(file.type) || /\.(jpe?g|jpe)$/i.test(file.name || '');
const isHeic = (file) => /^image\/hei[cf]$/.test(file.type) || /\.hei[cf]$/i.test(file.name || '');

async function smaller(file) {
    if (!(file instanceof Blob) || !(isHeic(file) || (isJpeg(file) && file.size >= MIN_BYTES))) return file;
    let bitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const scale = MAX_SIDE / Math.max(bitmap.width, bitmap.height);
        if (scale >= 1 && !isHeic(file)) return file;
        const w = Math.round(bitmap.width * Math.min(scale, 1)), h = Math.round(bitmap.height * Math.min(scale, 1));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, w, h);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        canvas.width = canvas.height = 0;
        if (!blob) return file;
        const name = (file.name || 'image').replace(/\.[^.]*$/, '') + '.jpg';
        return new File([blob], name, { type: 'image/jpeg' });
    } catch (e) {
        return file;
    } finally {
        if (bitmap) bitmap.close();
    }
}

export function patchSmallerPhotos() {
    const common = window.AscCommon;
    const upload = common && common.UploadImageFiles;
    if (typeof upload !== 'function' || upload.mekkoSmallerPhotos) return;
    const wrapped = function (files, ...rest) {
        if (!files || !files.length || typeof createImageBitmap !== 'function') return upload.call(this, files, ...rest);
        // One photo at a time: decoding several at once is the memory peak this avoids.
        (async () => {
            const list = [];
            for (const file of Array.from(files)) {
                const timeout = new Promise((resolve) => setTimeout(resolve, SHRINK_TIMEOUT, file));
                list.push(await Promise.race([smaller(file), timeout]));
            }
            return list;
        })().then((list) => upload.call(this, list, ...rest)).catch((e) => {
            // The callers wait for the callback to end their "uploading" action.
            console.warn('mekko photo upload:', e);
            const callback = rest[6];
            if (typeof callback === 'function') callback(Asc.c_oAscError.ID.UplImageUrl);
        });
    };
    wrapped.mekkoSmallerPhotos = true;
    common.UploadImageFiles = wrapped;
}
