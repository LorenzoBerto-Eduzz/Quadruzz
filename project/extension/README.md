# Quadruzz Companion

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `extension` folder.
4. Click the extension icon or press `Alt+Shift+Q` to toggle Cross.
5. Choose **Sign in with ChatGPT** if asked.

Authorization returns automatically to the Companion. On normal webpages, Cross appears as the floating overlay. On Chrome-protected pages such as a new tab, settings, or `chrome://extensions`, it uses Chrome's native action popup. Press `Alt+Shift+D` for acting-status controls or `Alt+Shift+S` for note controls.

The extension-owned background/offscreen sync keeps server-authoritative membership, status, notes, notifications, and presence current across the browser. Overlay visibility and an open Quadruzz webpage are not required for presence. If the browser closes or the device powers off without a clean disconnect, its activity expires after about 30 seconds without authenticated extension traffic.
