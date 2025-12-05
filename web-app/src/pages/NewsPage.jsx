import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Button, Divider, Chip, Grid, CircularProgress, Alert } from '@mui/material';
import { LocationOn, Phone, Star, AccessTime, Share, CheckCircle, Instagram, Facebook, YouTube, Verified, LocalShipping, Security, TrendingUp, EmojiEvents, Newspaper } from '@mui/icons-material';
import api from '../config/api';
import colors from '../theme/colors';

function NewsPage() {
  const [storeInfo, setStoreInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newsPosts, setNewsPosts] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);

  useEffect(() => {
    fetchStoreInfo();
    fetchNews();
  }, []);

  const fetchStoreInfo = async () => {
    try {
      const response = await api.get('/store/info', {
        timeout: 10000,
        params: { _t: Date.now() } // Cache busting
      });
      if (response.data) {
        setStoreInfo(response.data);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Network Error';
      console.error('Error fetching store info:', {
        message: errorMsg,
        status: error.response?.status,
        code: error.code
      });
      // Don't show error to user - use default data
    } finally {
      setLoading(false);
    }
  };

  const fetchNews = async () => {
    try {
      setLoadingNews(true);
      const response = await api.get('/news', {
        params: { limit: 20, page: 1 }
      });
      if (response.data?.news) {
        setNewsPosts(response.data.news);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      setNewsPosts([]);
    } finally {
      setLoadingNews(false);
    }
  };

  const handleSocialMediaClick = (url) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handlePhoneCall = (phoneNumber) => {
    if (phoneNumber) {
      window.open(`tel:${phoneNumber}`, '_self');
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      {/* News Posts Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Newspaper sx={{ mr: 1, color: colors.primary }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Latest News & Updates
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          {loadingNews ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : newsPosts.length === 0 ? (
            <Alert severity="info">No news posts available at the moment. Check back soon!</Alert>
          ) : (
            <Grid container spacing={2}>
              {newsPosts.map((post) => (
                <Grid item xs={12} key={post._id}>
                  <Card sx={{ 
                    borderLeft: `4px solid ${colors.primary}`,
                    '&:hover': { boxShadow: 4 }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Chip 
                              label={post.category || 'general'} 
                              size="small" 
                              sx={{ textTransform: 'capitalize' }}
                            />
                            {post.published && (
                              <Chip 
                                label="Published" 
                                size="small" 
                                color="success"
                              />
                            )}
                          </Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                            {post.title}
                          </Typography>
                          <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
                            {new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </Typography>
                        </Box>
                      </Box>
                      {post.image && (
                        <Box sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
                          <img 
                            src={post.image} 
                            alt={post.title}
                            style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </Box>
                      )}
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          color: colors.textPrimary, 
                          lineHeight: 1.8,
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {post.content}
                      </Typography>
                      {post.tags && post.tags.length > 0 && (
                        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {post.tags.map((tag, idx) => (
                            <Chip 
                              key={idx} 
                              label={tag} 
                              size="small" 
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Welcome Card */}
      <Card sx={{ mb: 3, background: `linear-gradient(135deg, ${colors.primaryVeryLight} 0%, ${colors.white} 100%)`, border: `2px solid ${colors.primary}` }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: colors.primaryDark, mr: 2 }}>
              👋
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: colors.primaryDark }}>
              Welcome to Jain Silver Plaza
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ color: colors.textPrimary, lineHeight: 1.8 }}>
            {storeInfo?.welcomeMessage ||
              'Your trusted partner for premium silver products. We offer the best quality silver coins, bars, and jewelry with transparent pricing and excellent customer service.'}
          </Typography>
        </CardContent>
      </Card>

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
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>Authentic Silver Products</Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>100% certified purity guaranteed</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, p: 1.5, backgroundColor: colors.primaryVeryLight, borderRadius: 2 }}>
                  <TrendingUp sx={{ color: colors.success, mr: 1.5, fontSize: 24 }} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>Live Market Rates</Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>Real-time pricing updated every second</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, p: 1.5, backgroundColor: colors.primaryVeryLight, borderRadius: 2 }}>
                  <Security sx={{ color: colors.success, mr: 1.5, fontSize: 24 }} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>Secure Transactions</Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>Safe and reliable payment options</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, p: 1.5, backgroundColor: colors.primaryVeryLight, borderRadius: 2 }}>
                  <LocalShipping sx={{ color: colors.success, mr: 1.5, fontSize: 24 }} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>Expert Service</Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>Professional guidance and support</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, p: 1.5, backgroundColor: colors.primaryVeryLight, borderRadius: 2 }}>
                  <EmojiEvents sx={{ color: colors.success, mr: 1.5, fontSize: 24 }} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>Best Silver Shop</Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>Top-rated in Vijayawada</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, p: 1.5, backgroundColor: colors.primaryVeryLight, borderRadius: 2 }}>
                  <CheckCircle sx={{ color: colors.success, mr: 1.5, fontSize: 24 }} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>Customer Satisfaction</Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>4.4⭐ rating with 84+ reviews</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
          
          {/* Services Section */}
          <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${colors.divider}` }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: colors.primaryDark }}>
              Our Services
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', backgroundColor: colors.primaryVeryLight }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>💰 Silver Coins</Typography>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                      Premium quality silver coins in various weights (1g, 5g, 10g, 50g, 100g) with 99.9% purity. 
                      Perfect for investment and gifting.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', backgroundColor: colors.primaryVeryLight }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>📦 Silver Bars</Typography>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                      High-purity silver bars (100g, 500g, 1kg) with 99.99% purity. Ideal for serious investors 
                      looking for bulk silver purchases.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', backgroundColor: colors.primaryVeryLight }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>💍 Silver Jewelry</Typography>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                      Exquisite handcrafted silver jewelry in 92.5% and 99.9% purity. Custom designs available 
                      to match your style and preferences.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Store Timings Card */}
      {storeInfo?.storeTimings && storeInfo.storeTimings.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AccessTime sx={{ mr: 1, color: colors.primary }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Store Timings
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {storeInfo.storeTimings.map((timing, index) => (
              <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{timing.day}:</Typography>
                <Typography variant="body1" sx={{ color: colors.textSecondary }}>
                  {timing.isClosed ? 'Closed' : `${timing.openTime} - ${timing.closeTime}`}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Store Location Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <LocationOn sx={{ mr: 1, color: colors.primary }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Store Location
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>Jain Silver Plaza</Typography>
          <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8 }}>
            Governerpet, Vijayawada, Andhra Pradesh<br />
            Gopala Reddy Road, Governerpet<br />
            Vijayawada-520002, Andhra Pradesh
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary, fontWeight: 500 }}>
            Open until 9:00 PM • 4.4 ⭐ (84 Ratings) • Claim this business
          </Typography>
          <Button
            variant="contained"
            onClick={() => window.open('https://www.google.com/maps/place/16%C2%B030\'41.3%22N+80%C2%B037\'33.3%22E/@16.511483,80.62592,17z/data=!3m1!4b1!4m4!3m3!8m2!3d16.511483!4d80.62592?entry=ttu&g_ep=EgoyMDI1MTEyMy4xIKXMDSoASAFQAw%3D%3D', '_blank')}
            startIcon={<LocationOn />}
            sx={{ backgroundColor: colors.primary, '&:hover': { backgroundColor: colors.primaryDark } }}
          >
            Open in Google Maps
          </Button>
        </CardContent>
      </Card>

      {/* Social Media Card */}
      {(storeInfo?.instagram || storeInfo?.facebook || storeInfo?.youtube) && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Share sx={{ mr: 1, color: colors.primary }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Follow Us
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              {storeInfo.instagram && (
                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Instagram />}
                    onClick={() => handleSocialMediaClick(storeInfo.instagram)}
                    sx={{
                      borderColor: '#E4405F',
                      color: '#E4405F',
                      '&:hover': { borderColor: '#E4405F', backgroundColor: 'rgba(228, 64, 95, 0.1)' },
                    }}
                  >
                    Instagram
                  </Button>
                </Grid>
              )}
              {storeInfo.facebook && (
                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Facebook />}
                    onClick={() => handleSocialMediaClick(storeInfo.facebook)}
                    sx={{
                      borderColor: '#1877F2',
                      color: '#1877F2',
                      '&:hover': { borderColor: '#1877F2', backgroundColor: 'rgba(24, 119, 242, 0.1)' },
                    }}
                  >
                    Facebook
                  </Button>
                </Grid>
              )}
              {storeInfo.youtube && (
                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<YouTube />}
                    onClick={() => handleSocialMediaClick(storeInfo.youtube)}
                    sx={{
                      borderColor: '#FF0000',
                      color: '#FF0000',
                      '&:hover': { borderColor: '#FF0000', backgroundColor: 'rgba(255, 0, 0, 0.1)' },
                    }}
                  >
                    YouTube
                  </Button>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Contact Card */}
      {storeInfo?.phoneNumber && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Phone sx={{ mr: 1, color: colors.primary }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Contact Us
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8 }}>
              Visit our showroom or call us for the best silver rates in Vijayawada. Our expert team is ready 
              to assist you with all your silver needs. We offer competitive pricing, authentic products, and 
              excellent customer service.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Store Phone</Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{storeInfo.phoneNumber}</Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<Phone />}
                onClick={() => handlePhoneCall(storeInfo.phoneNumber)}
                sx={{ backgroundColor: colors.primary }}
              >
                Call Now
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default NewsPage;

