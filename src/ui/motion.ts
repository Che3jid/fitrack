import { gsap } from 'gsap';

let activeMotion: ReturnType<typeof gsap.matchMedia> | null = null;
let previousRoute = '';
let previousGauge = 0;

export function stopMotion(): void {
  activeMotion?.revert();
  activeMotion = null;
}

export function animateView(root: HTMLElement, route: string): void {
  const sameRoute = route === previousRoute;
  const gauge = root.querySelector<HTMLElement>('.calorie-gauge');
  const targetGauge = gauge ? Number.parseFloat(gauge.style.getPropertyValue('--gauge-target')) || 0 : 0;
  const startGauge = sameRoute ? previousGauge : 0;

  stopMotion();
  previousRoute = route;
  previousGauge = targetGauge;

  const motion = gsap.matchMedia();
  activeMotion = motion;
  motion.add('(prefers-reduced-motion: no-preference)', () => {
    const heading = root.querySelector<HTMLElement>('.page-heading');
    const eyebrow = heading?.querySelector<HTMLElement>('.eyebrow');
    const dashboard = root.querySelector<HTMLElement>('.energy-dashboard');
    const activeTab = root.querySelector<HTMLElement>('.bottom-nav a[aria-current]');

    if (!sameRoute) {
      const entrance = gsap.timeline();
      if (eyebrow) entrance.fromTo(eyebrow, { autoAlpha: 0 }, { autoAlpha: 1, duration: .18, ease: 'steps(3)' });
      if (heading) entrance.fromTo(heading.querySelector('h1'), { y: 7, autoAlpha: .65 }, { y: 0, autoAlpha: 1, duration: .28, ease: 'power2.out' }, '<');
      if (dashboard) {
        entrance.fromTo(dashboard, { y: 6, scale: .985, autoAlpha: .8 }, { y: 0, scale: 1, autoAlpha: 1, duration: .36, ease: 'back.out(1.25)' }, '-=.04');
        entrance.fromTo(dashboard, { '--matrix-opacity': 0 }, { '--matrix-opacity': .35, duration: .3, ease: 'steps(5)' }, '<');
        const readouts = dashboard.querySelectorAll('.dashboard-stats > div');
        entrance.fromTo(readouts, { autoAlpha: .4 }, { autoAlpha: 1, duration: .18, stagger: .055, ease: 'steps(2)' }, '-=.2');
      }
      if (activeTab) entrance.fromTo(activeTab, { scale: .94 }, { scale: 1, duration: .22, ease: 'back.out(1.8)' }, 0);
    }

    if (gauge && targetGauge !== startGauge) {
      gsap.fromTo(gauge, { '--gauge-progress': `${startGauge}%` }, {
        '--gauge-progress': `${targetGauge}%`, duration: .95, ease: 'power2.out', delay: sameRoute ? 0 : .13,
      });
    }
    if (gauge) {
      const glow = gauge.querySelector<HTMLElement>('.gauge-glow');
      const sweep = gauge.querySelector<HTMLElement>('.gauge-sweep');
      const center = gauge.querySelector<HTMLElement>('.gauge-center');
      if (glow) {
        gsap.fromTo(glow, { autoAlpha: .15, scale: .92 }, { autoAlpha: .8, scale: 1, duration: .9, ease: 'power2.out' });
        gsap.timeline({ repeat: -1, delay: 1, repeatDelay: .25 })
          .to(glow, { opacity: 1, scale: 1.035, duration: 2.2, ease: 'sine.inOut' })
          .to(glow, { opacity: .68, scale: 1, duration: 2.2, ease: 'sine.inOut' });
      }
      if (sweep) gsap.timeline({ delay: .13 })
        .fromTo(sweep, { rotation: -110, opacity: 0 }, { rotation: 250, opacity: .8, duration: 1.25, ease: 'power2.inOut' })
        .to(sweep, { opacity: 0, duration: .22 }, '-=.22');
      if (center) gsap.fromTo(center, { autoAlpha: .7, scale: .95 }, { autoAlpha: 1, scale: 1, duration: .55, delay: .4, ease: 'back.out(1.35)' });
    }

    const pressable = '.primary, .secondary, .bottom-nav a';
    const getPressable = (event: Event): HTMLElement | null => {
      const target = event.target;
      if (!(target instanceof Element)) return null;
      const element = target.closest<HTMLElement>(pressable);
      return element && root.contains(element) ? element : null;
    };
    const press = (event: Event): void => {
      const element = getPressable(event);
      if (element) gsap.to(element, { y: 2, scale: .99, duration: .08, ease: 'power1.out', overwrite: true });
    };
    const release = (event: Event): void => {
      const element = getPressable(event);
      if (element) gsap.to(element, { y: 0, scale: 1, duration: .18, ease: 'back.out(1.7)', overwrite: true });
    };
    root.addEventListener('pointerdown', press);
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('pointerout', release);
    return () => {
      root.removeEventListener('pointerdown', press);
      root.removeEventListener('pointerup', release);
      root.removeEventListener('pointercancel', release);
      root.removeEventListener('pointerout', release);
    };
  }, root);
}
