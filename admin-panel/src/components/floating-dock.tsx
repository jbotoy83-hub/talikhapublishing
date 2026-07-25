import { useRef, useState, type ComponentType } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

export type DockItem = {
  index: number;
  title: string;
  icon: ComponentType<any>;
  onClick: () => void;
};

const SPRING = { mass: 0.1, stiffness: 150, damping: 12 };

export function FloatingDock({
  items,
  active,
  label,
}: {
  items: DockItem[];
  active: number;
  label: string;
}) {
  const mouseX = useMotionValue(Infinity);
  return (
    <nav
      className="tp-dock"
      aria-label={label}
      onMouseMove={(event) => mouseX.set(event.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
    >
      {items.map((item) => (
        <DockTile
          key={item.title}
          mouseX={mouseX}
          isActive={active === item.index}
          {...item}
        />
      ))}
    </nav>
  );
}

function DockTile({
  mouseX,
  title,
  icon: Icon,
  onClick,
  isActive,
}: DockItem & { mouseX: MotionValue<number>; isActive: boolean }) {
  const tileRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);

  const distance = useTransform(mouseX, (value: number) => {
    const bounds = tileRef.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return value - bounds.x - bounds.width / 2;
  });

  const tileWidth = useSpring(useTransform(distance, [-140, 0, 140], [44, 66, 44]), SPRING);
  const tileHeight = useSpring(useTransform(distance, [-140, 0, 140], [44, 66, 44]), SPRING);
  const iconSize = useSpring(useTransform(distance, [-140, 0, 140], [20, 30, 20]), SPRING);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      aria-current={isActive ? "page" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={"tp-dock__item" + (isActive ? " is-active" : "")}
    >
      <AnimatePresence>
        {hovered && (
          <motion.span
            className="tp-dock__tip"
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {title}
          </motion.span>
        )}
      </AnimatePresence>
      <motion.span
        ref={tileRef}
        className="tp-dock__tile"
        style={{ width: tileWidth, height: tileHeight }}
      >
        <motion.span className="tp-dock__icon" style={{ width: iconSize, height: iconSize }}>
          <Icon />
        </motion.span>
      </motion.span>
      <i className="tp-dock__dot" aria-hidden="true" />
    </button>
  );
}
