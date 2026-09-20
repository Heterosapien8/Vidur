const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

try {
  // 1. Read HTML and Content Script
  const htmlPath = path.resolve(__dirname, '../extension/test-page/login-test.html');
  const contentScriptPath = path.resolve(__dirname, '../extension/content-script.js');

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const contentScriptCode = fs.readFileSync(contentScriptPath, 'utf8');

  // 2. Initialize JSDOM
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost:3000/login-test.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });

  const { window } = dom;

  // Mock chrome API in test DOM environment
  window.chrome = {
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    }
  };

  // Polyfill minimal layout & getBoundingClientRect in JSDOM environment
  window.innerHeight = 800;
  window.innerWidth = 1200;

  window.getComputedStyle = function(el) {
    return {
      display: 'block',
      visibility: 'visible',
      opacity: '1'
    };
  };

  window.HTMLElement.prototype.getBoundingClientRect = function() {
    return {
      x: 100,
      y: 100,
      width: 250,
      height: 40,
      top: 100,
      left: 100,
      right: 350,
      bottom: 140
    };
  };

  // 3. Execute content-script in DOM window context
  window.eval(contentScriptCode);

  // 4. Run extractAccessibilityTree
  const elements = window.extractAccessibilityTree();

  console.log('--- Extracted Elements Summary ---');
  console.log(`Total interactive elements extracted: ${elements.length}\n`);

  console.table(elements.map(el => ({
    id: el.id,
    tag: el.tag,
    type: el.type,
    role: el.role,
    label: el.label,
    value: el.value,
    autocomplete: el.autocomplete
  })));

  // 5. Assertions
  const tests = [
    {
      desc: 'Extracts email input with correct label, type, and autocomplete',
      assert: () => {
        const email = elements.find(e => e.type === 'email');
        return email &&
               email.label === 'Email Address' &&
               email.autocomplete === 'email' &&
               email.value === 'developer@vidur.ai';
      }
    },
    {
      desc: 'Extracts password input with correct label and type',
      assert: () => {
        const pw = elements.find(e => e.type === 'password');
        return pw &&
               pw.label === 'Password' &&
               pw.autocomplete === 'current-password' &&
               pw.value === 'SuperSecret123!';
      }
    },
    {
      desc: 'Extracts role select dropdown with associated label',
      assert: () => {
        const sel = elements.find(e => e.tag === 'select');
        return sel && sel.label === 'Workspace Role' && sel.value === 'developer';
      }
    },
    {
      desc: 'Extracts remember me checkbox with associated label and checked value',
      assert: () => {
        const cb = elements.find(e => e.type === 'checkbox');
        return cb && cb.label === 'Remember this browser' && cb.value === 'on';
      }
    },
    {
      desc: 'Extracts submit button with button text',
      assert: () => {
        const btn = elements.find(e => e.type === 'submit');
        return btn && btn.label.includes('Sign In to Vidur') && btn.role === 'button';
      }
    },
    {
      desc: 'Extracts Google OAuth button with aria-label',
      assert: () => {
        const oauth = elements.find(e => e.label && e.label.includes('Sign in with Google'));
        return oauth && oauth.tag === 'button';
      }
    },
    {
      desc: 'Extracts links (Forgot Password & Create Account)',
      assert: () => {
        const links = elements.filter(e => e.tag === 'a');
        return links.length >= 2 && links.some(l => l.label === 'Forgot Password?');
      }
    }
  ];

  let allPassed = true;
  console.log('\n--- Running Assertions ---');
  tests.forEach((t, i) => {
    const passed = t.assert();
    if (!passed) allPassed = false;
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${t.desc}`);
  });

  if (allPassed) {
    console.log('\n🎉 ALL DOM EXTRACTION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('\n❌ SOME TESTS FAILED.');
    process.exit(1);
  }
} catch (err) {
  console.error('Test execution error:', err);
  process.exit(1);
}
