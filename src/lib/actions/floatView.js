/**
 * Svelte action for bidirectional floating view animation on scroll
 * @param {HTMLElement} node
 * @param {Object} [options]
 * @param {Element|null} [options.root]
 * @param {number|number[]} [options.threshold]
 * @param {string} [options.rootMargin]
 */
export function floatView(node, options = {}) {
  // Guard for SSR or environments without IntersectionObserver
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    node.classList.add('is-visible');
    return {
      destroy() {}
    };
  }

  const root = options.root !== undefined ? options.root : (node.closest('.tab-slide-panel') || null);
  const threshold = options.threshold ?? 0.1;
  const rootMargin = options.rootMargin ?? '0px 0px -40px 0px';

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        node.classList.add('is-visible');
      } else {
        node.classList.remove('is-visible');
      }
    }
  }, {
    root,
    threshold,
    rootMargin
  });

  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    }
  };
}
