import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';
import tippy, { Instance, Props } from 'tippy.js';

@Directive({
  selector: '[appTippy]'
})
export class TippyDirective implements OnInit, OnDestroy {
  readonly appTippy = input<string>('');
  readonly tippyPlacement = input<Props['placement']>('top');

  private instance: Instance | null = null;
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  ngOnInit(): void {
    const content = this.appTippy();
    if (!content) {
      return;
    }
    this.instance = tippy(this.elementRef.nativeElement, {
      content,
      placement: this.tippyPlacement(),
      theme: 'light-border'
    });
  }

  ngOnDestroy(): void {
    this.instance?.destroy();
    this.instance = null;
  }
}
