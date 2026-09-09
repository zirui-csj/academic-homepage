/**
 * 全局客户端交互（渐进增强，全部功能在无 JS 时不影响内容阅读）：
 * 1. 移动端折叠菜单
 * 2. 导航当前板块高亮（IntersectionObserver）
 * 3. 滚动入场动效（F15.4，尊重 prefers-reduced-motion）
 * 4. 语言切换：点击写入偏好 + 悬停预取目标语言页（F14.4/F14.6）
 * 5. 顶栏滚动阴影
 */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 1. 移动端菜单 ----------
const menuBtn = document.querySelector<HTMLButtonElement>('[data-menu-btn]');
const mobileNav = document.querySelector<HTMLElement>('[data-mobile-nav]');
if (menuBtn && mobileNav) {
  const setOpen = (open: boolean) => {
    mobileNav.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute(
      'aria-label',
      open
        ? (menuBtn.dataset.closeLabel ?? 'Close menu')
        : (menuBtn.dataset.openLabel ?? 'Open menu'),
    );
  };
  menuBtn.addEventListener('click', () => setOpen(mobileNav.hidden));
  mobileNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
}

// ---------- 2. 导航当前板块高亮 + 5. 顶栏滚动态 ----------
const header = document.querySelector<HTMLElement>('[data-site-header]');
const sectionIds = ['education', 'research', 'publications', 'projects', 'awards'];

if (header) {
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

if ('IntersectionObserver' in window) {
  const navLinks = new Map<string, HTMLAnchorElement[]>();
  sectionIds.forEach((id) => {
    navLinks.set(
      id,
      Array.from(document.querySelectorAll<HTMLAnchorElement>(`[data-section-link="${id}"]`)),
    );
  });

  const activeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        navLinks.forEach((links, key) => {
          links.forEach((l) => l.classList.toggle('is-active', key === id));
        });
      });
    },
    { rootMargin: '-40% 0px -55% 0px' },
  );
  sectionIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) activeObserver.observe(el);
  });

  // ---------- 3. 滚动入场动效 ----------
  if (prefersReducedMotion) {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));
  }
} else {
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
}

// ---------- 4. 语言切换：写入偏好 + 预取 ----------
function prefetch(url: string) {
  if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
}

document.querySelectorAll<HTMLAnchorElement>('[data-lang-link]').forEach((a) => {
  const lang = a.dataset.langLink as string;
  a.addEventListener('click', () => {
    // 保持当前板块锚点（F14.4：/#publications → /en/#publications）
    const hash = location.hash;
    if (hash && !a.getAttribute('href')?.includes('#')) {
      a.href = (a.getAttribute('href') ?? '/') + hash;
    }
    try {
      localStorage.setItem('lang', lang);
    } catch (e) {
      /* 隐私模式下静默降级 */
    }
  });
  ['mouseenter', 'touchstart', 'focus'].forEach((evt) =>
    a.addEventListener(evt, () => prefetch(a.getAttribute('href') ?? '/'), { passive: true }),
  );
});
