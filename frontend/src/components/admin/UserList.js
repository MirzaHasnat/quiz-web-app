import React, { useState, useContext } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  IconButton,
  Chip,
  Tooltip,
  Box,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  LockReset as ResetPasswordIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
// Date formatting utilities
import { AuthContext } from '../../context/AuthContext';
import { toggleBlockUser, deleteUser, resetPassword } from '../../services/userService';
import ConfirmDialog from './ConfirmDialog';
import ResetPasswordDialog from './ResetPasswordDialog';

const UserList = ({
  users,
  pagination,
  sorting,
  onPageChange,
  onLimitChange,
  onSortChange,
  onEditUser,
  onUserAction,
  onRefresh
}) => {
  const { currentUser } = useContext(AuthContext);
  const [actionMenu, setActionMenu] = useState({
    anchorEl: null,
    user: null
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    action: null
  });
  const [resetDialog, setResetDialog] = useState({
    open: false,
    userId: null,
    username: ''
  });

  // Handle menu open
  const handleMenuOpen = (event, user) => {
    setActionMenu({
      anchorEl: event.currentTarget,
      user
    });
  };

  // Handle menu close
  const handleMenuClose = () => {
    setActionMenu({
      anchorEl: null,
      user: null
    });
  };

  // Handle block/unblock user
  const handleToggleBlock = async (user) => {
    try {
      const newBlockStatus = !user.isBlocked;
      const action = newBlockStatus ? 'block' : 'unblock';
      
      setConfirmDialog({
        open: true,
        title: newBlockStatus ? 'Block User' : 'Unblock User',
        message: newBlockStatus
          ? `Are you sure you want to block ${user.username}? They will no longer be able to access the system.`
          : `Are you sure you want to unblock ${user.username}? They will regain access to the system.`,
        action: async () => {
          await toggleBlockUser(user._id, newBlockStatus);
          onRefresh();
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      });
    } catch (error) {
      console.error('Error toggling user block status:', error);
    } finally {
      handleMenuClose();
    }
  };

  // Handle delete user
  const handleDelete = (user) => {
    setConfirmDialog({
      open: true,
      title: 'Delete User',
      message: `Are you sure you want to delete ${user.username}? This action cannot be undone.`,
      action: async () => {
        try {
          await deleteUser(user._id);
          onRefresh();
        } catch (error) {
          console.error('Error deleting user:', error);
        } finally {
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      }
    });
    handleMenuClose();
  };

  // Handle reset password
  const handleResetPassword = (user) => {
    setResetDialog({
      open: true,
      userId: user._id,
      username: user.username
    });
    handleMenuClose();
  };

  // Handle reset password submit
  const handleResetPasswordSubmit = async (newPassword) => {
    try {
      await resetPassword(resetDialog.userId, newPassword);
      onRefresh();
      setResetDialog(prev => ({ ...prev, open: false }));
    } catch (error) {
      console.error('Error resetting password:', error);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      // Format: "Jan 1, 2023 2:30 PM"
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sorting.sortBy === 'username'}
                  direction={sorting.sortBy === 'username' ? sorting.sortOrder : 'asc'}
                  onClick={() => onSortChange('username')}
                >
                  Username
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sorting.sortBy === 'role'}
                  direction={sorting.sortBy === 'role' ? sorting.sortOrder : 'asc'}
                  onClick={() => onSortChange('role')}
                >
                  Role
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sorting.sortBy === 'isBlocked'}
                  direction={sorting.sortBy === 'isBlocked' ? sorting.sortOrder : 'asc'}
                  onClick={() => onSortChange('isBlocked')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sorting.sortBy === 'createdAt'}
                  direction={sorting.sortBy === 'createdAt' ? sorting.sortOrder : 'asc'}
                  onClick={() => onSortChange('createdAt')}
                >
                  Created
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sorting.sortBy === 'updatedAt'}
                  direction={sorting.sortBy === 'updatedAt' ? sorting.sortOrder : 'asc'}
                  onClick={() => onSortChange('updatedAt')}
                >
                  Last Updated
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length > 0 ? (
              users.map((user) => (
                <TableRow key={user._id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role}
                      color={user.role === 'admin' ? 'secondary' : 'primary'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.isBlocked ? 'Blocked' : 'Active'}
                      color={user.isBlocked ? 'error' : 'success'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>{formatDate(user.updatedAt)}</TableCell>
                  <TableCell align="right">
                    {/* Don't allow actions on self */}
                    {currentUser.id !== user._id ? (
                      <>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => onEditUser(user)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, user)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : (
                      <Chip
                        label="Current User"
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Box sx={{ py: 3 }}>
                    <Typography variant="body1" color="textSecondary">
                      No users found
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={pagination.total}
          rowsPerPage={pagination.limit}
          page={pagination.page - 1}
          onPageChange={onPageChange}
          onRowsPerPageChange={onLimitChange}
        />
      </TableContainer>

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenu.anchorEl}
        open={Boolean(actionMenu.anchorEl)}
        onClose={handleMenuClose}
      >
        {actionMenu.user && (
          <>
            <MenuItem onClick={() => handleToggleBlock(actionMenu.user)}>
              <ListItemIcon>
                {actionMenu.user.isBlocked ? <CheckCircleIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText>
                {actionMenu.user.isBlocked ? 'Unblock User' : 'Block User'}
              </ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleResetPassword(actionMenu.user)}>
              <ListItemIcon>
                <ResetPasswordIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Reset Password</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleDelete(actionMenu.user)}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText sx={{ color: 'error.main' }}>Delete User</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={resetDialog.open}
        username={resetDialog.username}
        onClose={() => setResetDialog(prev => ({ ...prev, open: false }))}
        onSubmit={handleResetPasswordSubmit}
      />
    </>
  );
};

export default UserList;