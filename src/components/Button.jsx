import React from 'react';
import '../styles/neu.css';

const Button = ({
    children,
    onClick,
    disabled,
    className = '',
    style,
    type = 'button',
    variant = 'primary',
    size = 'md'
}) => {
    const variantClass = variant === 'ghost' ? 'neu-btn--ghost' : variant === 'danger' ? 'neu-btn--danger' : '';
    const sizeClass = size === 'sm' ? 'neu-btn--sm' : '';

    return (
        <button
            type={type}
            className={`neu-btn ${variantClass} ${sizeClass} ${className}`.trim()}
            onClick={onClick}
            disabled={disabled}
            style={style}
        >
            {children}
        </button>
    );
};

export default Button;