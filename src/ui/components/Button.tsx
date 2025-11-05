import React from 'react';

/**
 * Button component props extending native button HTML attributes.
 */
interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant of the button (default: 'primary') */
  variant?: 'primary' | 'secondary';
  /** Compact size for inline actions (default: false) */
  small?: boolean;
}

/**
 * Button Component
 *
 * A styled button component that matches Figma's UI design system.
 * Supports primary (blue) and secondary (gray) variants, plus a compact
 * size for use in tables or inline contexts.
 *
 * Memoized to prevent unnecessary re-renders when props haven't changed.
 *
 * Styles are defined in styles.css and use Figma CSS variables for theming.
 *
 * @example
 * ```tsx
 * <Button onClick={handleClick}>Save</Button>
 * <Button variant="secondary" disabled>Cancel</Button>
 * <Button small>⋮</Button>
 * ```
 */
const ButtonComponent: React.FC<Props> = ({ variant = 'primary', small, children, ...rest }) => {
  return (
    <button
      {...rest}
      className={`button button--${variant}`}
      style={{ fontSize: small ? 11 : 12, padding: small ? '4px 8px' : '6px 10px' }}
    >
      {children}
    </button>
  );
};

ButtonComponent.displayName = 'Button';

export const Button = React.memo(ButtonComponent);
