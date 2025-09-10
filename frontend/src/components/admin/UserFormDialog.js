import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Alert,
  Box,
  CircularProgress,
  Switch,
  FormControlLabel
} from '@mui/material';
import { createUser, updateUser } from '../../services/userService';

const UserFormDialog = ({ open, user, onClose }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user',
    isBlocked: false
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Reset form when dialog opens/closes or user changes
  useEffect(() => {
    if (open) {
      if (user) {
        // Edit mode - populate form with user data
        setFormData({
          username: user.username || '',
          password: '', // Don't populate password for security
          role: user.role || 'user',
          isBlocked: user.isBlocked || false
        });
      } else {
        // Create mode - reset form
        setFormData({
          username: '',
          password: '',
          role: 'user',
          isBlocked: false
        });
      }
      setErrors({});
      setError(null);
      setSuccess(false);
    }
  }, [open, user]);

  // Handle form input change
  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'isBlocked' ? checked : value
    }));
    
    // Clear field-specific error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.length > 50) {
      newErrors.username = 'Username cannot exceed 50 characters';
    }
    
    if (!user && !formData.password.trim()) {
      newErrors.password = 'Password is required for new users';
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.role) {
      newErrors.role = 'Role is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      if (user) {
        // Update existing user
        const userData = {
          username: formData.username,
          role: formData.role,
          isBlocked: formData.isBlocked
        };
        
        // Only include password if it was provided
        if (formData.password.trim()) {
          userData.password = formData.password;
        }
        
        await updateUser(user._id, userData);
      } else {
        // Create new user
        await createUser(formData);
      }
      
      setSuccess(true);
      
      // Close dialog after a short delay to show success message
      setTimeout(() => {
        onClose(true); // Pass true to indicate refresh needed
      }, 1500);
    } catch (err) {
      setError(err.message || (user ? 'Failed to update user' : 'Failed to create user'));
      
      // Handle specific API errors
      if (err.code === 'USER_EXISTS' || err.code === 'USERNAME_EXISTS') {
        setErrors(prev => ({ ...prev, username: 'Username already exists' }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <DialogTitle>{user ? 'Edit User' : 'Create New User'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              User {user ? 'updated' : 'created'} successfully!
            </Alert>
          )}
          
          <TextField
            margin="dense"
            label="Username"
            name="username"
            fullWidth
            variant="outlined"
            value={formData.username}
            onChange={handleChange}
            error={Boolean(errors.username)}
            helperText={errors.username}
            disabled={loading}
            autoFocus
          />
          
          <TextField
            margin="dense"
            label={user ? "New Password (leave blank to keep current)" : "Password"}
            name="password"
            type="password"
            fullWidth
            variant="outlined"
            value={formData.password}
            onChange={handleChange}
            error={Boolean(errors.password)}
            helperText={errors.password}
            disabled={loading}
          />
          
          <FormControl
            fullWidth
            margin="dense"
            variant="outlined"
            error={Boolean(errors.role)}
            disabled={loading}
          >
            <InputLabel>Role</InputLabel>
            <Select
              name="role"
              value={formData.role}
              onChange={handleChange}
              label="Role"
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
            {errors.role && <FormHelperText>{errors.role}</FormHelperText>}
          </FormControl>
          
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isBlocked}
                  onChange={handleChange}
                  name="isBlocked"
                  color="error"
                  disabled={loading}
                />
              }
              label="Block User"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading || success}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {user ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserFormDialog;