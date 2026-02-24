import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Menu,
  MenuItem,
} from '@mui/material';
import api from '../config/api';
import colors from '../theme/colors';

const compressImage = (file) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const maxWidth = 1000;
        const maxHeight = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // fallback
          }
        }, 'image/jpeg', 0.7);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

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
  const fileInputs = useRef({});

  const handleFileChange = (field, event) => {
    if (event.target.files && event.target.files[0]) {
      setFiles({ ...files, [field]: event.target.files[0] });
    }
  };

  const handleUploadClick = (field) => {
    if (fileInputs.current[field]) {
      fileInputs.current[field].click();
    }
  };

  const handleRegister = async () => {
    if (!formData.surname || !formData.lastName || !formData.email || !formData.phone || !formData.password || !formData.aadharNumber || !formData.panNumber) {
      setError('Please fill all required fields, including Aadhar and PAN numbers');
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
      const compressedAadharFront = await compressImage(files.aadharFront);
      const compressedAadharBack = await compressImage(files.aadharBack);
      const compressedPanImage = await compressImage(files.panImage);
      const compressedSelfie = await compressImage(files.selfie);

      data.append('aadharFront', compressedAadharFront);
      data.append('aadharBack', compressedAadharBack);
      data.append('panImage', compressedPanImage);
      data.append('selfie', compressedSelfie);

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
        if (responseData.errors && Array.isArray(responseData.errors)) {
          const errorMsgs = responseData.errors.map(e => e.msg || e.message).join('\n');
          setError(errorMsgs || 'Registration failed');
        } else {
          setError(responseData.message || responseData.error || 'Registration failed');
        }
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
          <Button
            variant="outlined"
            fullWidth
            sx={{ mt: 2 }}
            onClick={() => handleUploadClick('aadharFront')}
          >
            {files.aadharFront ? 'Aadhar Front Uploaded ✓' : 'Upload Aadhar Front'}
          </Button>
          <input
            type="file"
            hidden
            accept="image/*"
            ref={(input) => {
              if (input) fileInputs.current.aadharFront = input;
            }}
            onChange={(e) => handleFileChange('aadharFront', e)}
          />
          <Button
            variant="outlined"
            fullWidth
            sx={{ mt: 1 }}
            onClick={() => handleUploadClick('aadharBack')}
          >
            {files.aadharBack ? 'Aadhar Back Uploaded ✓' : 'Upload Aadhar Back'}
          </Button>
          <input
            type="file"
            hidden
            accept="image/*"
            ref={(input) => {
              if (input) fileInputs.current.aadharBack = input;
            }}
            onChange={(e) => handleFileChange('aadharBack', e)}
          />
          <TextField fullWidth label="PAN Number" value={formData.panNumber} onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })} margin="normal" />
          <Button
            variant="outlined"
            fullWidth
            sx={{ mt: 1 }}
            onClick={() => handleUploadClick('panImage')}
          >
            {files.panImage ? 'PAN Image Uploaded ✓' : 'Upload PAN Image'}
          </Button>
          <input
            type="file"
            hidden
            accept="image/*"
            ref={(input) => {
              if (input) fileInputs.current.panImage = input;
            }}
            onChange={(e) => handleFileChange('panImage', e)}
          />
          <Button
            variant="outlined"
            fullWidth
            sx={{ mt: 1 }}
            onClick={() => handleUploadClick('selfie')}
          >
            {files.selfie ? 'Selfie Uploaded ✓' : 'Upload Selfie'}
          </Button>
          <input
            type="file"
            hidden
            accept="image/*"
            ref={(input) => {
              if (input) fileInputs.current.selfie = input;
            }}
            onChange={(e) => handleFileChange('selfie', e)}
          />
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

