tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t starts with "chrome://extensions" then
        return execute t javascript "(function() {
          function findAndReload(root) {
            var items = root.querySelectorAll('extensions-item');
            for (var i = 0; i < items.length; i++) {
              var s = items[i].shadowRoot;
              var name = s && s.querySelector('#name');
              if (name && name.textContent.indexOf('FilOzone') !== -1) {
                var btn = s.querySelector('#dev-reload-button');
                if (btn) { btn.click(); return 'reloaded'; }
              }
            }
            var all = root.querySelectorAll('*');
            for (var j = 0; j < all.length; j++) {
              if (all[j].shadowRoot) { var r = findAndReload(all[j].shadowRoot); if (r) return r; }
            }
            return null;
          }
          return findAndReload(document) || 'not found';
        })()"
      end if
    end repeat
  end repeat
end tell
