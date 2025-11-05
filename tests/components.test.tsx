/**
 * Component Tests
 *
 * Tests for all UI components with React Testing Library.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from '../src/ui/components/Button';
import { TextInput } from '../src/ui/components/TextInput';
import { Toast, ToastContainer } from '../src/ui/components/Toast';
import { LoadingState } from '../src/ui/components/LoadingState';
import ErrorBoundary from '../src/ui/components/ErrorBoundary';
import type { Notification } from '../src/ui/hooks';

describe('Button Component', () => {
  it('renders children correctly', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('renders with primary variant by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByText('Primary');
    expect(button).toHaveClass('button--primary');
  });

  it('renders with secondary variant when specified', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByText('Secondary');
    expect(button).toHaveClass('button--secondary');
  });

  it('applies small size styles when small prop is true', () => {
    render(<Button small>Small</Button>);
    const button = screen.getByText('Small');
    expect(button).toHaveStyle({ fontSize: '11px', padding: '4px 8px' });
  });

  it('applies regular size styles by default', () => {
    render(<Button>Regular</Button>);
    const button = screen.getByText('Regular');
    expect(button).toHaveStyle({ fontSize: '12px', padding: '6px 10px' });
  });

  it('handles onClick events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Clickable</Button>);
    fireEvent.click(screen.getByText('Clickable'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('respects disabled attribute', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );
    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('forwards native button attributes', () => {
    render(
      <Button type="submit" data-testid="submit-button">
        Submit
      </Button>
    );
    const button = screen.getByTestId('submit-button');
    expect(button).toHaveAttribute('type', 'submit');
  });
});

describe('TextInput Component', () => {
  it('renders label correctly', () => {
    render(<TextInput label="Username" value="" onChange={() => {}} />);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('renders input with correct value', () => {
    render(<TextInput label="Email" value="test@example.com" onChange={() => {}} />);
    const input = screen.getByDisplayValue('test@example.com');
    expect(input).toBeInTheDocument();
  });

  it('handles onChange events', () => {
    const handleChange = vi.fn();
    render(<TextInput label="Name" value="" onChange={handleChange} />);
    const input = screen.getByLabelText('Name');
    fireEvent.change(input, { target: { value: 'John' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('applies placeholder attribute', () => {
    render(<TextInput label="Repo" value="" placeholder="my-repo" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('my-repo')).toBeInTheDocument();
  });

  it('respects disabled attribute', () => {
    render(<TextInput label="Disabled" value="" disabled onChange={() => {}} />);
    expect(screen.getByLabelText('Disabled')).toBeDisabled();
  });

  it('forwards native input attributes', () => {
    render(
      <TextInput label="Password" type="password" value="" maxLength={20} onChange={() => {}} />
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('maxLength', '20');
  });

  it('has correct semantic markup', () => {
    render(<TextInput label="Field" value="" onChange={() => {}} />);
    const label = screen.getByText('Field').closest('label');
    expect(label).toHaveStyle({ display: 'flex', flexDirection: 'column' });
  });
});

describe('Toast Component', () => {
  it('renders notification message', () => {
    const notification: Notification = {
      id: 1,
      message: 'Success!',
      level: 'info',
    };
    render(<Toast notification={notification} onDismiss={() => {}} />);
    expect(screen.getByText('Success!')).toBeInTheDocument();
  });

  it('applies info styling for info level', () => {
    const notification: Notification = {
      id: 1,
      message: 'Info message',
      level: 'info',
    };
    render(<Toast notification={notification} onDismiss={() => {}} />);
    const toast = screen.getByText('Info message');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });

  it('applies error styling for error level', () => {
    const notification: Notification = {
      id: 1,
      message: 'Error message',
      level: 'error',
    };
    render(<Toast notification={notification} onDismiss={() => {}} />);
    const toast = screen.getByText('Error message');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
  });

  it('calls onDismiss when clicked', () => {
    const handleDismiss = vi.fn();
    const notification: Notification = {
      id: 42,
      message: 'Click me',
      level: 'info',
    };
    render(<Toast notification={notification} onDismiss={handleDismiss} />);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleDismiss).toHaveBeenCalledWith(42);
  });

  it('has correct accessibility attributes', () => {
    const notification: Notification = {
      id: 1,
      message: 'Accessible toast',
      level: 'info',
    };
    render(<Toast notification={notification} onDismiss={() => {}} />);
    const toast = screen.getByRole('status');
    expect(toast).toBeInTheDocument();
  });
});

describe('ToastContainer Component', () => {
  it('renders nothing when no notifications', () => {
    const { container } = render(<ToastContainer notifications={[]} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders multiple notifications', () => {
    const notifications: Notification[] = [
      { id: 1, message: 'First', level: 'info' },
      { id: 2, message: 'Second', level: 'error' },
    ];
    render(<ToastContainer notifications={notifications} onDismiss={() => {}} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('includes animation styles', () => {
    const notifications: Notification[] = [{ id: 1, message: 'Animated', level: 'info' }];
    const { container } = render(
      <ToastContainer notifications={notifications} onDismiss={() => {}} />
    );
    const style = container.querySelector('style');
    expect(style).toBeInTheDocument();
    expect(style?.textContent).toContain('@keyframes slideIn');
  });
});

describe('LoadingState Component', () => {
  it('renders loading message', () => {
    render(<LoadingState message="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders submessage when provided', () => {
    render(<LoadingState message="Syncing" submessage="Please wait..." />);
    expect(screen.getByText('Syncing')).toBeInTheDocument();
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('does not render submessage when not provided', () => {
    render(<LoadingState message="Loading" />);
    expect(screen.queryByText('Please wait...')).not.toBeInTheDocument();
  });

  it('includes spinner element', () => {
    const { container } = render(<LoadingState message="Spinning" />);
    const spinner = container.querySelector('[style*="animation"]');
    expect(spinner).toBeInTheDocument();
  });

  it('has correct semantic structure', () => {
    const { container } = render(<LoadingState message="Test" />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ display: 'flex', alignItems: 'center' });
  });
});

describe('ErrorBoundary Component', () => {
  // Suppress console.error for these tests
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it('displays error message in error state', () => {
    const ThrowError = () => {
      throw new Error('Specific test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Specific test error/i)).toBeInTheDocument();
  });

  it('renders reload button in error state', () => {
    const ThrowError = () => {
      throw new Error('Error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Reload/i)).toBeInTheDocument();
  });
});
