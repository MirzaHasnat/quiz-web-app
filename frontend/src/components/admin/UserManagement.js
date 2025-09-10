import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import UserList from './UserList';
import UserFormDialog from './UserFormDialog';
import ConfirmDialog from './ConfirmDialog';
import { getUsers, getUserStats } from '../../services/userService';
import { useDebounce } from '../../hooks/useDebounce';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    role: '',
    isBlocked: ''
  });

  // Debounce search term for API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [sorting, setSorting] = useState({
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [stats, setStats] = useState({
    total: 0,
    admins: 0,
    users: 0,
    blocked: 0
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    action: null
  });

  // Fetch users with current filters, pagination, and sorting
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: sorting.sortBy,
        sortOrder: sorting.sortOrder
      };

      // Add debounced search term if present (text-based search)
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }

      // Add filters if present
      if (filters.role) {
        params.role = filters.role;
      }

      if (filters.isBlocked !== '') {
        params.isBlocked = filters.isBlocked;
      }

      const response = await getUsers(params);
      setUsers(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, sorting.sortBy, sorting.sortOrder, debouncedSearchTerm, filters]);

  // Fetch user statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await getUserStats();
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch user statistics:', err);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [fetchUsers, fetchStats]);

  // Handle search - immediate UI update, debounced API call
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    // Reset to first page when search changes (will trigger via useEffect)
  };

  // Reset pagination when debounced search term changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [debouncedSearchTerm]);

  // Handle filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on filter change
  };

  // Handle sort change
  const handleSortChange = (sortBy) => {
    setSorting(prev => ({
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage + 1 }));
  };

  // Handle rows per page change
  const handleLimitChange = (event) => {
    setPagination(prev => ({
      ...prev,
      limit: parseInt(event.target.value, 10),
      page: 1
    }));
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchUsers();
    fetchStats();
  };

  // Handle add user
  const handleAddUser = () => {
    setSelectedUser(null);
    setOpenDialog(true);
  };

  // Handle edit user
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setOpenDialog(true);
  };

  // Handle dialog close
  const handleDialogClose = (refresh = false) => {
    setOpenDialog(false);
    if (refresh) {
      fetchUsers();
      fetchStats();
    }
  };

  // Handle user action (block/unblock, delete)
  const handleUserAction = (action, user) => {
    switch (action) {
      case 'block':
        setConfirmDialog({
          open: true,
          title: 'Block User',
          message: `Are you sure you want to block ${user.username}? They will no longer be able to access the system.`,
          action: () => {
            // Block action will be handled in UserList component
            setConfirmDialog(prev => ({ ...prev, open: false }));
          }
        });
        break;
      case 'unblock':
        setConfirmDialog({
          open: true,
          title: 'Unblock User',
          message: `Are you sure you want to unblock ${user.username}? They will regain access to the system.`,
          action: () => {
            // Unblock action will be handled in UserList component
            setConfirmDialog(prev => ({ ...prev, open: false }));
          }
        });
        break;
      case 'delete':
        setConfirmDialog({
          open: true,
          title: 'Delete User',
          message: `Are you sure you want to delete ${user.username}? This action cannot be undone.`,
          action: () => {
            // Delete action will be handled in UserList component
            setConfirmDialog(prev => ({ ...prev, open: false }));
          }
        });
        break;
      default:
        break;
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setFilters({
      role: '',
      isBlocked: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h2">
          User Management
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddUser}
        >
          Add User
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" color="textSecondary">Total Users</Typography>
            <Typography variant="h4">{stats.total}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" color="textSecondary">Admin Users</Typography>
            <Typography variant="h4">{stats.admins}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" color="textSecondary">Regular Users</Typography>
            <Typography variant="h4">{stats.users}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" color="textSecondary">Blocked Users</Typography>
            <Typography variant="h4">{stats.blocked}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search Users by Name"
              placeholder="Type username to search..."
              variant="outlined"
              value={searchTerm}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              helperText={loading && debouncedSearchTerm !== searchTerm ? "Searching..." : ""}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Role</InputLabel>
              <Select
                name="role"
                value={filters.role}
                onChange={handleFilterChange}
                label="Role"
              >
                <MenuItem value="">All Roles</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="user">User</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Status</InputLabel>
              <Select
                name="isBlocked"
                value={filters.isBlocked}
                onChange={handleFilterChange}
                label="Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="false">Active</MenuItem>
                <MenuItem value="true">Blocked</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              sx={{ mr: 1 }}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={resetFilters}
            >
              Reset
            </Button>
          </Grid>
        </Grid>

        {/* Active Filters */}
        {(searchTerm || filters.role || filters.isBlocked !== '') && (
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mr: 1, alignSelf: 'center' }}>
              Active Filters:
            </Typography>
            {searchTerm && (
              <Chip
                label={`Search: ${searchTerm}`}
                onDelete={() => setSearchTerm('')}
                size="small"
              />
            )}
            {filters.role && (
              <Chip
                label={`Role: ${filters.role}`}
                onDelete={() => setFilters(prev => ({ ...prev, role: '' }))}
                size="small"
              />
            )}
            {filters.isBlocked !== '' && (
              <Chip
                label={`Status: ${filters.isBlocked === 'true' ? 'Blocked' : 'Active'}`}
                onDelete={() => setFilters(prev => ({ ...prev, isBlocked: '' }))}
                size="small"
              />
            )}
          </Box>
        )}
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* User List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <UserList
          users={users}
          pagination={pagination}
          sorting={sorting}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          onSortChange={handleSortChange}
          onEditUser={handleEditUser}
          onUserAction={handleUserAction}
          onRefresh={handleRefresh}
        />
      )}

      {/* User Form Dialog */}
      <UserFormDialog
        open={openDialog}
        user={selectedUser}
        onClose={handleDialogClose}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </Box>
  );
};

export default UserManagement;