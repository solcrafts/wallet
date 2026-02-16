import React from 'react';
import '../styles/neu.css';

const Input = ({ value, onChange, placeholder, type = 'text', className = '', style }) => {
    return (
        <input
            className={`neu-input ${className}`.trim()}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            style={style}
        />
    );
};

export default Input;