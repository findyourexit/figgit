import React from 'react';

/**
 * TextInput component props extending native input HTML attributes.
 */
interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text displayed above the input field */
  label: string;
}

/**
 * TextInput Component
 *
 * A labeled text input component styled to match Figma's UI design system.
 * The label and input are vertically stacked with consistent spacing and typography.
 *
 * Memoized to prevent unnecessary re-renders when props haven't changed.
 *
 * Styles use Figma CSS variables for automatic theming (light/dark mode).
 * Additional styling is defined in styles.css.
 *
 * @example
 * ```tsx
 * <TextInput
 *   label="Repository"
 *   value={repo}
 *   onChange={(e) => setRepo(e.target.value)}
 *   placeholder="my-repo"
 * />
 * ```
 */
const TextInputComponent: React.FC<Props> = ({ label, ...rest }) => {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11 }}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <input {...rest} style={{ fontSize: 11, padding: '4px 6px' }} />
    </label>
  );
};

TextInputComponent.displayName = 'TextInput';

export const TextInput = React.memo(TextInputComponent);
