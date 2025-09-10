import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Alert
} from '@mui/material';

const ResetPasswordDialog = ({ open, username, onClose, onSubmit }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmPassword('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords
    if (!password) {
      setError('Password is required');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      setLoading(true);
      await onSubmit(password);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose}>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Reset Password for {username}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Enter a new password for this user. The password must be at least 6 characters long.
          </DialogContentText>
          
          {error && (
            <Alert severity="error" sx={{ mt: 2, mb: 1 }}>
              {error}
            </Alert>
          )}
          
          <TextField
            margin="dense"
            label="New Password"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            disabled={loading}
            autoFocus
          />
          
          <TextField
            margin="dense"
            label="Confirm Password"
            type="password"
            fullWidth
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError('');
            }}
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            color="primary"
            variant="contained"
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            Reset Password
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ResetPasswordDialog;