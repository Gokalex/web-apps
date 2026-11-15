// LibreOffice and Collabora name an East Asian font (SimSun, Noto Serif CJK SC) in their default styles. sdkjs
// replaces a font the server lacks with the closest installed one, here a CJK font (WenQuanYi Zen Hei, 16.8 MB)
// downloaded at every first opening even with no CJK text. Use Arial instead for missing fonts; CJK characters
// still get a font from sdkjs's per-character fallback (FontPickerByCharacter).
const CJK_CODE_PAGES = 0x003E0000;   // OS/2 ulCodePageRange1 bits 17-21: JIS, GB2312, Wansung, Big5, Johab
const CJK_FONT = /^(WenQuanYi|AR PL |Droid Sans Fallback|Takao|Nanum|Noto (Sans|Serif)( Mono)? (CJK|JP|KR|SC|TC|HK)|Source Han|IPA|VL Gothic|Sazanami|Un(Batang|Dotum)|Baekmuk)/i;

const key = (name) => name.toLowerCase().replace(/[\s_,-]/g, '');
const isCjk = (font) => ((font.m_ulCodePageRange1 & CJK_CODE_PAGES) !== 0) || CJK_FONT.test(font.m_wsFontName);

// The font to use for a requested name: the picked one when it is installed under that name or is not CJK.
function lightFont(app, pick, name, font, style) {
    if (typeof name !== 'string' || !font || typeof font.m_wsFontName !== 'string') return font;
    const asked = key(name);
    const installed = [font.m_wsFontName].concat(font.m_names || []).some((n) => typeof n === 'string' && key(n) === asked);
    if (installed || !isCjk(font)) return font;
    const light = pick.call(app, 'Arial', style);
    app.FontPickerMap[name] = light;
    if (window.onLogPickFont) window.onLogPickFont(`FontPicker: ${name} => ${light.m_wsFontName} (instead of ${font.m_wsFontName})`);
    return light;
}

function lighten(app) {
    if (!app || app.__lightEastAsian) return;
    if (typeof app.GetFontFileWeb !== 'function' || !app.FontPickerMap) {
        console.warn('lightEastAsianFonts: sdkjs font picker not found, East Asian fallback fonts load as usual');
        return;
    }
    app.__lightEastAsian = true;
    const pick = app.GetFontFileWeb;
    // Names resolved before the patch (sdk-all.js already loaded): check them too.
    for (const name of Object.keys(app.FontPickerMap)) lightFont(app, pick, name, app.FontPickerMap[name], 0);
    app.GetFontFileWeb = function (name, style) {
        if (Object.prototype.hasOwnProperty.call(this.FontPickerMap, name)) return this.FontPickerMap[name];
        return lightFont(this, pick, name, pick.call(this, name, style), style);
    };
}

// Call before the API object is created, so the hook is in place before the document asks for its fonts: sdk-all.js,
// which creates AscFonts.g_fontApplication, may load later.
export function patchLightEastAsianFonts() {
    const AF = window.AscFonts;
    if (!AF) {
        console.warn('lightEastAsianFonts: AscFonts not found, East Asian fallback fonts load as usual');
        return;
    }
    if (AF.g_fontApplication) return lighten(AF.g_fontApplication);
    let app;
    Object.defineProperty(AF, 'g_fontApplication', {
        configurable: true, enumerable: true,
        get: () => app,
        set: (value) => { app = value; lighten(value); },
    });
}
