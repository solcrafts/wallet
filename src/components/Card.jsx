import React from 'react';
import '../styles/neu.css';

const Card = ({ children, className = '', style, variant = 'default' }) => {
    const variantClass = variant === 'inset' ? 'neu-card--inset' : '';

    return (
        <div className={`neu-card ${variantClass} ${className}`.trim()} style={style}>
            {children}
        </div>
    );
};

export default Card;