import { Platform } from 'react-native';

/**
 * Injects scrollbar CSS into <head> (web only, once per session).
 *
 * Why so aggressive:
 *   React Native Web hides the native browser scrollbar via an auto-generated
 *   CSS class (e.g. `.r-xxxxxx { scrollbar-width: none }`) regardless of the
 *   showsVerticalScrollIndicator prop in some versions.  We need !important
 *   overrides AND we target both the nativeID element AND its first child `div`
 *   because the actual overflow div in RN Web's ScrollView can be one level
 *   deeper than the element that receives the `id` attribute.
 *
 *   We also use `getScrollableNode()` in the screens to grab the real DOM node
 *   and stamp it with the .crwn-profile-scroll class, which this file targets
 *   as a third fallback.
 */
const STYLE_ID = 'crwn-profile-scrollbar-css';

export function injectScrollbarCSS() {
  if (Platform.OS !== 'web') return;
  if (document.getElementById(STYLE_ID)) return; // already injected

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* ── Native <div> scroll containers (web profile screens) ───────────── */
    .crwn-profile-scroll-div {
      overflow-y: scroll !important;
    }

    /* ── Chrome / Safari webkit scrollbar ───────────────────────────────── */
    .crwn-profile-scroll-div::-webkit-scrollbar {
      display: block !important;
      width: 8px !important;
    }
    .crwn-profile-scroll-div::-webkit-scrollbar-track {
      background: transparent !important;
    }
    .crwn-profile-scroll-div::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.22) !important;
      border-radius: 4px !important;
    }
    .crwn-profile-scroll-div::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.4) !important;
    }
  `;
  document.head.appendChild(style);
}

