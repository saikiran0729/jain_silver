import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import api from '../config/api';
import colors from '../theme/colors';

function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    surname: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    aadharNumber: '',
    panNumber: '',
  });
  const [files, setFiles] = useState({
    aadharFront: null,
    aadharBack: null,
    panImage: null,
    selfie: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (field, event) => {
    setFiles({ ...files, [field]: event.target.files[0] });
  };

  const handleRegister = async () => {
    if (!formData.surname || !formData.lastName || !formData.email || !formData.phone || !formData.password) {
      setError('Please fill all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!files.aadharFront || !files.aadharBack || !files.panImage || !files.selfie) {
      setError('Please upload all required documents including selfie');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = new FormData();
      data.append('surname', formData.surname.trim());
      data.append('lastName', formData.lastName.trim());
      data.append('name', (formData.surname.trim() + ' ' + formData.lastName.trim()).trim());
      data.append('email', formData.email.toLowerCase().trim());
      data.append('phone', formData.phone.trim());
      data.append('password', formData.password);
      data.append('aadharNumber', formData.aadharNumber.trim());
      data.append('panNumber', formData.panNumber.trim().toUpperCase());
      data.append('aadharFront', files.aadharFront);
      data.append('aadharBack', files.aadharBack);
      data.append('panImage', files.panImage);
      data.append('selfie', files.selfie);

      const response = await fetch(api.defaults.baseURL + '/auth/register', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: data,
      });

      const responseData = await response.json();

      if (response.ok && responseData.userId) {
        alert('Registration Successful! Your account is pending admin approval. You can sign in once your account is approved.');
        navigate('/');
      } else {
        setError(responseData.message || 'Registration failed');
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, backgroundColor: colors.background }}>
      <Card sx={{ maxWidth: 600, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
            Register
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField fullWidth label="Surname" value={formData.surname} onChange={(e) => setFormData({ ...formData, surname: e.target.value })} margin="normal" />
          <TextField fullWidth label="Last Name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} margin="normal" />
          <TextField fullWidth label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} margin="normal" />
          <TextField fullWidth label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} margin="normal" />
          <TextField fullWidth label="Password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} margin="normal" />
          <TextField fullWidth label="Confirm Password" type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} margin="normal" />
          <TextField fullWidth label="Aadhar Number" value={formData.aadharNumber} onChange={(e) => setFormData({ ...formData, aadharNumber: e.target.value })} margin="normal" />
          <Button variant="outlined" component="label" fullWidth sx={{ mt: 2 }}>
            Upload Aadhar Front
            <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange('aadharFront', e)} />
          </Button>
          <Button variant="outlined" component="label" fullWidth sx={{ mt: 1 }}>
            Upload Aadhar Back
            <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange('aadharBack', e)} />
          </Button>
          <TextField fullWidth label="PAN Number" value={formData.panNumber} onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })} margin="normal" />
          <Button variant="outlined" component="label" fullWidth sx={{ mt: 1 }}>
            Upload PAN Image
            <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange('panImage', e)} />
          </Button>
          <Button variant="outlined" component="label" fullWidth sx={{ mt: 1 }}>
            {files.selfie ? 'Selfie Uploaded ✓' : 'Upload Selfie'}
            <input type="file" hidden accept="image/*" capture="user" onChange={(e) => handleFileChange('selfie', e)} />
          </Button>
          <Button fullWidth variant="contained" onClick={handleRegister} disabled={loading} sx={{ mt: 3 }}>
            {loading ? 'Registering...' : 'Register'}
          </Button>
          <Button fullWidth variant="text" onClick={() => navigate('/')} sx={{ mt: 1 }}>
            Already have an account? Sign In
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

export default RegisterPage;

