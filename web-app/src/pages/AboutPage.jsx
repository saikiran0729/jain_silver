import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Divider, Chip, Grid } from '@mui/material';
import { Star, Verified, LocalShipping, Security, TrendingUp, EmojiEvents } from '@mui/icons-material';
import api from '../config/api';
import colors from '../theme/colors';

function AboutPage() {
  const [storeInfo, setStoreInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStoreInfo();
  }, []);

  const fetchStoreInfo = async () => {
    try {
      const response = await api.get('/store/info', {
        timeout: 10000,
        params: { _t: Date.now() }
      });
      if (response.data) {
        setStoreInfo(response.data);
      }
    } catch (error) {
      console.error('Error fetching store info:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      {/* About Us Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mr: 1 }}>
              ℹ️
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              About Us
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>Jain Silver Plaza</Typography>
          <Typography variant="subtitle2" sx={{ mb: 2, color: colors.textSecondary, fontWeight: 600 }}>
            Silver Jewellery Manufacturers & Jewellery Showrooms
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 1.5, backgroundColor: colors.primaryVeryLight, borderRadius: 2, width: 'fit-content' }}>
            <Star sx={{ color: '#FFC107', mr: 1 }} />
            <Typography variant="h6" sx={{ mr: 1, fontWeight: 700 }}>4.4</Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>(84 Ratings)</Typography>
          </Box>
          <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8, fontWeight: 500 }}>
            Jain Silver Plaza is recognized as one of the <strong>best silver shops in Vijayawada</strong> and Andhra Pradesh. 
            With years of experience in silver jewellery manufacturing and retail, we have built a reputation for 
            excellence, authenticity, and customer satisfaction. Our commitment to quality and transparency has made 
            us a trusted name in the silver industry.
          </Typography>
          <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8 }}>
            We specialize in premium quality silver coins, bars, and exquisite jewellery pieces. Located in the 
            heart of Vijayawada, we have been serving customers with authentic silver products and transparent 
            pricing for years. Our showroom offers a wide range of silver products including coins, bars, and 
            custom jewellery designs.
          </Typography>
          <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8 }}>
            We maintain the highest standards of quality and provide excellent customer service to ensure your 
            complete satisfaction. Every product is certified for purity and authenticity, giving you peace of 
            mind with your investment.
          </Typography>
          <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${colors.divider}` }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: colors.primaryDark }}>
              Why Choose Jain Silver Plaza?
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, p: 1.5, backgroundColor: colors.primaryVeryLight, borderRadius: 2 }}>
                  <Verified sx={{ color: colors.success, mr: 1.5, fontSize: 24 }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Authentic Products</Typography>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                      All products are certified for purity and authenticity
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, p: 1.5, backgroundColor: colors.primaryVeryLight, borderRadius: 2 }}>
                  <TrendingUp sx={{ color: colors.primary, mr: 1.5, fontSize: 24 }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Transparent Pricing</Typography>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                      Live rates updated every second for complete transparency
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, p: 1.5, backgroundColor: colors.primaryVeryLight, borderRadius: 2 }}>
                  <LocalShipping sx={{ color: colors.accent, mr: 1.5, fontSize: 24 }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Wide Range</Typography>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                      Coins, bars, and custom jewellery designs available
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, p: 1.5, backgroundColor: colors.primaryVeryLight, borderRadius: 2 }}>
                  <Security sx={{ color: colors.warning, mr: 1.5, fontSize: 24 }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Secure Transactions</Typography>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                      Safe and secure payment options available
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default AboutPage;

