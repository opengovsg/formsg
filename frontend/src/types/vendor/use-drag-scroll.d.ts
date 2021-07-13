declare module 'use-drag-scroll' {
  type SwipeOptions = {
    sliderRef: ReactRef
    reliants?: any[]
    momentumVelocity?: number
  }
  function useSwipeScroll({
    sliderRef,
    reliants = [],
    momentumVelocity = 0.9,
  }: SwipeOptions): { hasSwiped: boolean }

  export { useSwipeScroll as default }
}
