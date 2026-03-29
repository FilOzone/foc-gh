tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t starts with "chrome://extensions" then
        return execute t javascript "(function() {
          function findBtn(root) {
            var btn = root.getElementById ? root.getElementById('dev-reload-button') : null;
            if (btn) return btn;
            var all = root.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
              if (all[i].id === 'dev-reload-button') return all[i];
              if (all[i].shadowRoot) {
                var r = findBtn(all[i].shadowRoot);
                if (r) return r;
              }
            }
            return null;
          }
          var btn = findBtn(document);
          if (btn) { btn.click(); return 'reloaded'; }
          return 'not found';
        })()"
      end if
    end repeat
  end repeat
end tell
