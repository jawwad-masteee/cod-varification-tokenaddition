// COD Verifier JavaScript - Enhanced with UPI Deep Links and Real-time Status Updates
jQuery(document).ready(function($) {
    'use strict';
    
    // Global variables
    let otpTimer = null;
    let tokenTimer = null;
    let paymentStatusPoller = null;
    let currentPaymentId = null;
    let currentOrderId = null;
    
    // Initialize the verification system
    initCODVerifier();
    
    function initCODVerifier() {
        // Show verification box when COD is selected
        $(document).on('change', 'input[name="payment_method"]', function() {
            if ($(this).val() === 'cod') {
                showVerificationBox();
            } else {
                hideVerificationBox();
            }
        });
        
        // Initialize if COD is already selected
        if ($('input[name="payment_method"]:checked').val() === 'cod') {
            showVerificationBox();
        }
        
        // Bind event handlers
        bindEventHandlers();
        
        // Update phone help text based on country selection
        updatePhoneHelpText();
    }
    
    function bindEventHandlers() {
        // Country code change handler
        $(document).on('change', '#cod_country_code', function() {
            updatePhoneHelpText();
            $('#cod_phone').val(''); // Clear phone input when country changes
        });
        
        // Send OTP handler
        $(document).on('click', '#cod_send_otp', function() {
            sendOTP();
        });
        
        // Verify OTP handler
        $(document).on('click', '#cod_verify_otp', function() {
            verifyOTP();
        });
        
        // Phone input validation
        $(document).on('input', '#cod_phone', function() {
            validatePhoneInput();
        });
        
        // OTP input validation
        $(document).on('input', '#cod_otp', function() {
            validateOTPInput();
        });
        
        // Token payment handler
        $(document).on('click', '#cod_pay_token', function() {
            initiateTokenPayment();
        });
        
        // Token confirmation checkbox
        $(document).on('change', '#cod_token_confirmed', function() {
            updateTokenStatus();
        });
    }
    
    function showVerificationBox() {
        const wrapper = $('#cod-verifier-wrapper');
        const template = $('#cod-verification-template');
        
        if (wrapper.length === 0 && template.length > 0) {
            // Create wrapper from template
            const content = template.html();
            const newWrapper = $('<div id="cod-verifier-wrapper-active">' + content + '</div>');
            
            // Insert before checkout actions
            const checkoutActions = $('.wc-block-checkout__actions_row, .woocommerce-checkout-review-order, #place_order').first().parent();
            if (checkoutActions.length > 0) {
                checkoutActions.before(newWrapper);
            } else {
                $('form.checkout, form.wc-block-checkout__form').append(newWrapper);
            }
        } else if (wrapper.length > 0) {
            wrapper.attr('id', 'cod-verifier-wrapper-active').show();
        }
        
        // Show warning message
        showWarningMessage();
        
        // Update country help text
        updatePhoneHelpText();
    }
    
    function hideVerificationBox() {
        $('#cod-verifier-wrapper, #cod-verifier-wrapper-active').hide();
        hideWarningMessage();
        
        // Clear any running timers
        clearTimers();
    }
    
    function showWarningMessage() {
        // Remove existing warning
        $('.cod-verification-warning').remove();
        
        const warningHtml = `
            <div class="cod-verification-warning">
                <div class="cod-warning-content">
                    <span class="cod-warning-icon">⚠️</span>
                    <span class="cod-warning-text">Complete verification before placing order</span>
                </div>
            </div>
        `;
        
        // Insert after checkout actions
        const checkoutActions = $('.wc-block-checkout__actions_row, .woocommerce-checkout-review-order').last();
        if (checkoutActions.length > 0) {
            checkoutActions.after(warningHtml);
        }
    }
    
    function hideWarningMessage() {
        $('.cod-verification-warning').remove();
    }
    
    function updatePhoneHelpText() {
        const countryCode = $('#cod_country_code').val();
        const helpText = $('#cod_phone_help_text');
        
        let helpMessage = '';
        switch(countryCode) {
            case '+91':
                helpMessage = 'Enter 10-digit Indian mobile number (e.g., 7039940998)';
                break;
            case '+1':
                helpMessage = 'Enter 10-digit US phone number (e.g., 2125551234)';
                break;
            case '+44':
                helpMessage = 'Enter UK phone number (e.g., 7700900123)';
                break;
            default:
                helpMessage = 'Select country and enter phone number';
        }
        
        helpText.text(helpMessage);
    }
    
    function validatePhoneInput() {
        const phone = $('#cod_phone').val();
        const countryCode = $('#cod_country_code').val();
        const sendBtn = $('#cod_send_otp');
        
        let isValid = false;
        
        switch(countryCode) {
            case '+91':
                isValid = /^[6-9]\d{9}$/.test(phone);
                break;
            case '+1':
                isValid = /^[2-9]\d{9}$/.test(phone);
                break;
            case '+44':
                isValid = /^7\d{9}$/.test(phone);
                break;
        }
        
        sendBtn.prop('disabled', !isValid);
        return isValid;
    }
    
    function validateOTPInput() {
        const otp = $('#cod_otp').val();
        const verifyBtn = $('#cod_verify_otp');
        
        const isValid = /^\d{6}$/.test(otp);
        verifyBtn.prop('disabled', !isValid);
        return isValid;
    }
    
    function sendOTP() {
        const phone = $('#cod_phone').val();
        const countryCode = $('#cod_country_code').val();
        const fullPhone = countryCode + phone;
        
        if (!validatePhoneInput()) {
            showMessage('cod_otp_message', 'Please enter a valid phone number', 'error');
            return;
        }
        
        const sendBtn = $('#cod_send_otp');
        sendBtn.prop('disabled', true).text('Sending...');
        
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_send_otp',
                phone: fullPhone,
                country_code: countryCode,
                phone_number: phone,
                nonce: codVerifier.nonce
            },
            success: function(response) {
                if (response.success) {
                    showMessage('cod_otp_message', response.data.message, 'success');
                    startOTPTimer();
                    
                    // Show OTP in test mode
                    if (response.data.test_mode && response.data.otp) {
                        setTimeout(function() {
                            alert('TEST MODE - Your OTP is: ' + response.data.otp);
                        }, 500);
                    }
                } else {
                    showMessage('cod_otp_message', response.data || 'Failed to send OTP', 'error');
                    sendBtn.prop('disabled', false).text('Send OTP');
                }
            },
            error: function() {
                showMessage('cod_otp_message', 'Network error. Please try again.', 'error');
                sendBtn.prop('disabled', false).text('Send OTP');
            }
        });
    }
    
    function verifyOTP() {
        const otp = $('#cod_otp').val();
        
        if (!validateOTPInput()) {
            showMessage('cod_otp_message', 'Please enter a valid 6-digit OTP', 'error');
            return;
        }
        
        const verifyBtn = $('#cod_verify_otp');
        verifyBtn.prop('disabled', true).text('Verifying...');
        
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_verify_otp',
                otp: otp,
                nonce: codVerifier.nonce
            },
            success: function(response) {
                if (response.success) {
                    showMessage('cod_otp_message', response.data, 'success');
                    updateStatusBadge('cod-otp-badge', 'verified');
                    verifyBtn.removeClass('cod-btn-success').addClass('verified').text('✓ Verified');
                    
                    // Add hidden input for form submission
                    if ($('input[name="cod_otp_verified"]').length === 0) {
                        $('form.checkout, form.wc-block-checkout__form').append('<input type="hidden" name="cod_otp_verified" value="1">');
                    }
                } else {
                    showMessage('cod_otp_message', response.data || 'Invalid OTP', 'error');
                    verifyBtn.prop('disabled', false).text('Verify');
                }
            },
            error: function() {
                showMessage('cod_otp_message', 'Network error. Please try again.', 'error');
                verifyBtn.prop('disabled', false).text('Verify');
            }
        });
    }
    
    function startOTPTimer() {
        const sendBtn = $('#cod_send_otp');
        const duration = parseInt(codVerifier.otpTimerDuration) || 30;
        let timeLeft = duration;
        
        // Clear any existing timer
        if (otpTimer) {
            clearInterval(otpTimer);
        }
        
        // Update button state
        sendBtn.addClass('cod-btn-timer-active');
        
        otpTimer = setInterval(function() {
            sendBtn.text('Resend (' + timeLeft + 's)');
            timeLeft--;
            
            if (timeLeft < 0) {
                clearInterval(otpTimer);
                sendBtn.removeClass('cod-btn-timer-active')
                      .prop('disabled', false)
                      .text('Send OTP');
                otpTimer = null;
            }
        }, 1000);
    }
    
    function initiateTokenPayment() {
        const payBtn = $('#cod_pay_token');
        payBtn.prop('disabled', true).text('Creating Payment...');
        
        // Check if test mode
        if (codVerifier.testMode === '1') {
            handleTestModePayment();
            return;
        }
        
        // Create payment link for production
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_create_payment_link',
                nonce: codVerifier.nonce
            },
            success: function(response) {
                if (response.success) {
                    currentOrderId = response.data.link_id;
                    
                    // Check if mobile device
                    if (isMobileDevice()) {
                        // Mobile: Open Razorpay popup
                        openRazorpayPopup(response.data);
                    } else {
                        // Desktop: Show QR code with UPI deep link
                        showQRCodePayment(response.data);
                    }
                } else {
                    showMessage('cod_token_message', response.data || 'Failed to create payment', 'error');
                    payBtn.prop('disabled', false).text('Pay ₹1 Token');
                }
            },
            error: function() {
                showMessage('cod_token_message', 'Network error. Please try again.', 'error');
                payBtn.prop('disabled', false).text('Pay ₹1 Token');
            }
        });
    }
    
    function handleTestModePayment() {
        // Simulate payment process in test mode
        showMessage('cod_token_message', 'Test mode: Simulating payment...', 'success');
        
        setTimeout(function() {
            $.ajax({
                url: codVerifier.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cod_verify_token_payment',
                    test_mode: '1',
                    nonce: codVerifier.nonce
                },
                success: function(response) {
                    if (response.success) {
                        showSuccessAnimation();
                        updateTokenStatus(true);
                    }
                }
            });
        }, 2000);
    }
    
    function showQRCodePayment(paymentData) {
        // Generate UPI deep link instead of Razorpay link
        const upiLink = generateUPIDeepLink(paymentData);
        
        // Create QR code modal
        const modalHtml = `
            <div id="cod-qr-modal" class="cod-qr-modal">
                <div class="cod-qr-content">
                    <div class="cod-qr-header">
                        <h3>Scan QR Code to Pay ₹1</h3>
                        <button class="cod-qr-close" onclick="closeCODQRModal()">&times;</button>
                    </div>
                    <div class="cod-qr-body">
                        <div id="cod-qr-code" class="cod-qr-code-container"></div>
                        <p class="cod-qr-info">🛈 Scan QR code with any UPI app</p>
                        <p class="cod-qr-trust">🔒 Secure Payment · ₹1 will be refunded</p>
                        <div class="cod-qr-timer">
                            <span>Payment expires in: <span id="cod-payment-timer">15:00</span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal and add new one
        $('#cod-qr-modal').remove();
        $('body').append(modalHtml);
        
        // Generate QR code with UPI deep link
        if (typeof QRCode !== 'undefined') {
            new QRCode(document.getElementById('cod-qr-code'), {
                text: upiLink,
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff'
            });
        }
        
        // Start payment timer
        startPaymentTimer(15 * 60); // 15 minutes
        
        // Start polling for payment status
        startPaymentStatusPolling(paymentData.link_id);
        
        // Show modal
        $('#cod-qr-modal').show();
    }
    
    function generateUPIDeepLink(paymentData) {
        // Generate UPI deep link for direct app opening
        const upiParams = {
            pa: 'merchant@upi', // This should come from backend/Razorpay
            pn: 'COD Verifier',
            mc: '0000',
            tid: paymentData.link_id || 'TXN' + Date.now(),
            tr: paymentData.link_id || 'REF' + Date.now(),
            tn: 'COD Token Payment',
            am: '1.00',
            cu: 'INR'
        };
        
        const params = Object.keys(upiParams)
            .map(key => `${key}=${encodeURIComponent(upiParams[key])}`)
            .join('&');
            
        return `upi://pay?${params}`;
    }
    
    function openRazorpayPopup(paymentData) {
        // Mobile: Use Razorpay popup
        const options = {
            key: paymentData.key || 'rzp_test_key',
            amount: 100, // ₹1 in paise
            currency: 'INR',
            name: 'COD Token Payment',
            description: '₹1 verification payment for COD order',
            order_id: paymentData.link_id,
            handler: function(response) {
                currentPaymentId = response.razorpay_payment_id;
                verifyPaymentSuccess(response);
            },
            prefill: {
                contact: $('#cod_phone').val()
            },
            theme: {
                color: '#667eea'
            },
            modal: {
                ondismiss: function() {
                    $('#cod_pay_token').prop('disabled', false).text('Pay ₹1 Token');
                    showMessage('cod_token_message', 'Payment cancelled. Please try again.', 'error');
                }
            }
        };
        
        if (typeof Razorpay !== 'undefined') {
            const rzp = new Razorpay(options);
            rzp.open();
        } else {
            showMessage('cod_token_message', 'Payment system not loaded. Please refresh the page.', 'error');
            $('#cod_pay_token').prop('disabled', false).text('Pay ₹1 Token');
        }
    }
    
    function startPaymentTimer(seconds) {
        let timeLeft = seconds;
        const timerElement = $('#cod-payment-timer');
        
        if (tokenTimer) {
            clearInterval(tokenTimer);
        }
        
        tokenTimer = setInterval(function() {
            const minutes = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerElement.text(`${minutes}:${secs.toString().padStart(2, '0')}`);
            
            timeLeft--;
            
            if (timeLeft < 0) {
                clearInterval(tokenTimer);
                closeCODQRModal();
                showMessage('cod_token_message', 'Payment session expired. Please try again.', 'error');
                $('#cod_pay_token').prop('disabled', false).text('Pay ₹1 Token');
            }
        }, 1000);
    }
    
    function startPaymentStatusPolling(linkId) {
        if (paymentStatusPoller) {
            clearInterval(paymentStatusPoller);
        }
        
        paymentStatusPoller = setInterval(function() {
            $.ajax({
                url: codVerifier.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cod_check_payment_status',
                    link_id: linkId,
                    nonce: codVerifier.nonce
                },
                success: function(response) {
                    if (response.success && response.data.status === 'paid') {
                        clearInterval(paymentStatusPoller);
                        currentPaymentId = response.data.payment_id;
                        
                        // Verify payment
                        verifyPaymentSuccess({
                            razorpay_payment_id: response.data.payment_id,
                            razorpay_order_id: linkId
                        });
                    }
                }
            });
        }, 5000); // Poll every 5 seconds
    }
    
    function verifyPaymentSuccess(paymentResponse) {
        $.ajax({
            url: codVerifier.ajaxUrl,
            type: 'POST',
            data: {
                action: 'cod_verify_token_payment',
                payment_id: paymentResponse.razorpay_payment_id,
                payment_link_id: paymentResponse.razorpay_order_id,
                nonce: codVerifier.nonce
            },
            success: function(response) {
                if (response.success) {
                    showSuccessAnimation();
                    updateTokenStatus(true);
                } else {
                    showMessage('cod_token_message', response.data || 'Payment verification failed', 'error');
                    $('#cod_pay_token').prop('disabled', false).text('Pay ₹1 Token');
                }
            },
            error: function() {
                showMessage('cod_token_message', 'Verification failed. Please contact support.', 'error');
                $('#cod_pay_token').prop('disabled', false).text('Pay ₹1 Token');
            }
        });
    }
    
    function showSuccessAnimation() {
        // Close QR modal if open
        closeCODQRModal();
        
        // Create success popup
        const successHtml = `
            <div id="cod-success-modal" class="cod-success-modal">
                <div class="cod-success-content">
                    <div class="cod-success-animation">
                        <div class="cod-checkmark">
                            <div class="cod-checkmark-circle"></div>
                            <div class="cod-checkmark-stem"></div>
                            <div class="cod-checkmark-kick"></div>
                        </div>
                    </div>
                    <h3>Payment Successful!</h3>
                    <p>✅ Your payment is successful. Your money will be refunded shortly.</p>
                    <div class="cod-success-timer">
                        <span>Closing in <span id="cod-success-countdown">5</span> seconds...</span>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(successHtml);
        $('#cod-success-modal').show();
        
        // Countdown timer
        let countdown = 5;
        const countdownTimer = setInterval(function() {
            countdown--;
            $('#cod-success-countdown').text(countdown);
            
            if (countdown <= 0) {
                clearInterval(countdownTimer);
                $('#cod-success-modal').remove();
            }
        }, 1000);
        
        // Auto-close after 5 seconds
        setTimeout(function() {
            $('#cod-success-modal').remove();
        }, 5000);
    }
    
    function updateTokenStatus(verified = false) {
        if (verified) {
            updateStatusBadge('cod-token-badge', 'verified');
            $('#cod_pay_token').removeClass('cod-btn-warning').addClass('verified').text('✓ Payment Complete');
            $('#cod_token_confirmed').prop('checked', true);
            
            // Add hidden input for form submission
            if ($('input[name="cod_token_verified"]').length === 0) {
                $('form.checkout, form.wc-block-checkout__form').append('<input type="hidden" name="cod_token_verified" value="1">');
            }
            
            showMessage('cod_token_message', 'Token payment completed successfully!', 'success');
        }
    }
    
    function updateStatusBadge(badgeId, status) {
        const badge = $('#' + badgeId);
        badge.removeClass('pending verified').addClass(status);
        badge.text(status === 'verified' ? 'Verified' : 'Pending');
    }
    
    function showMessage(containerId, message, type) {
        const container = $('#' + containerId);
        container.removeClass('success error').addClass(type).text(message).show();
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(function() {
                container.fadeOut();
            }, 5000);
        }
    }
    
    function isMobileDevice() {
        return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    function clearTimers() {
        if (otpTimer) {
            clearInterval(otpTimer);
            otpTimer = null;
        }
        if (tokenTimer) {
            clearInterval(tokenTimer);
            tokenTimer = null;
        }
        if (paymentStatusPoller) {
            clearInterval(paymentStatusPoller);
            paymentStatusPoller = null;
        }
    }
    
    // Global function to close QR modal
    window.closeCODQRModal = function() {
        $('#cod-qr-modal').remove();
        clearTimers();
        $('#cod_pay_token').prop('disabled', false).text('Pay ₹1 Token');
    };
    
    // Cleanup on page unload
    $(window).on('beforeunload', function() {
        clearTimers();
    });
});

// Additional CSS for animations and modals
const additionalCSS = `
<style>
.cod-qr-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: none;
    z-index: 10000;
    align-items: center;
    justify-content: center;
}

.cod-qr-content {
    background: white;
    border-radius: 12px;
    padding: 0;
    max-width: 400px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
}

.cod-qr-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 12px 12px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.cod-qr-header h3 {
    margin: 0;
    font-size: 18px;
}

.cod-qr-close {
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.cod-qr-body {
    padding: 30px;
    text-align: center;
}

.cod-qr-code-container {
    margin: 20px auto;
    display: inline-block;
    padding: 20px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.cod-qr-info {
    color: #667eea;
    font-weight: 500;
    margin: 15px 0 5px 0;
}

.cod-qr-trust {
    color: #10b981;
    font-size: 14px;
    margin: 5px 0 20px 0;
}

.cod-qr-timer {
    background: #fef3c7;
    color: #92400e;
    padding: 10px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
}

.cod-success-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
}

.cod-success-content {
    background: white;
    border-radius: 12px;
    padding: 40px;
    text-align: center;
    max-width: 400px;
    width: 90%;
}

.cod-success-animation {
    margin-bottom: 20px;
}

.cod-checkmark {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: block;
    stroke-width: 3;
    stroke: #10b981;
    stroke-miterlimit: 10;
    margin: 0 auto 20px;
    position: relative;
    animation: cod-checkmark-fill 0.4s ease-in-out 0.4s forwards, cod-checkmark-scale 0.3s ease-in-out 0.9s both;
}

.cod-checkmark-circle {
    stroke-dasharray: 166;
    stroke-dashoffset: 166;
    stroke-width: 3;
    stroke-miterlimit: 10;
    stroke: #10b981;
    fill: none;
    animation: cod-checkmark-stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
    position: absolute;
    top: 0;
    left: 0;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 3px solid #10b981;
}

.cod-checkmark-stem {
    position: absolute;
    width: 3px;
    height: 20px;
    background: #10b981;
    left: 32px;
    top: 45px;
    transform: rotate(45deg);
    transform-origin: left bottom;
    animation: cod-checkmark-stem 0.3s ease-in-out 0.9s both;
}

.cod-checkmark-kick {
    position: absolute;
    width: 3px;
    height: 12px;
    background: #10b981;
    left: 25px;
    top: 52px;
    transform: rotate(-45deg);
    transform-origin: left bottom;
    animation: cod-checkmark-kick 0.2s ease-in-out 1.15s both;
}

.cod-success-content h3 {
    color: #10b981;
    margin: 0 0 15px 0;
    font-size: 24px;
}

.cod-success-content p {
    color: #374151;
    margin: 0 0 20px 0;
    line-height: 1.5;
}

.cod-success-timer {
    color: #6b7280;
    font-size: 14px;
}

@keyframes cod-checkmark-stroke {
    100% {
        stroke-dashoffset: 0;
    }
}

@keyframes cod-checkmark-scale {
    0%, 100% {
        transform: none;
    }
    50% {
        transform: scale3d(1.1, 1.1, 1);
    }
}

@keyframes cod-checkmark-fill {
    100% {
        box-shadow: inset 0px 0px 0px 30px #10b981;
    }
}

@keyframes cod-checkmark-stem {
    0% {
        height: 0;
    }
    100% {
        height: 20px;
    }
}

@keyframes cod-checkmark-kick {
    0% {
        height: 0;
    }
    100% {
        height: 12px;
    }
}

@media (max-width: 768px) {
    .cod-qr-content {
        width: 95%;
        margin: 20px;
    }
    
    .cod-qr-body {
        padding: 20px;
    }
    
    .cod-success-content {
        width: 95%;
        padding: 30px 20px;
    }
    
    .cod-checkmark {
        width: 60px;
        height: 60px;
    }
    
    .cod-checkmark-circle {
        width: 60px;
        height: 60px;
    }
    
    .cod-checkmark-stem {
        left: 24px;
        top: 34px;
        height: 15px;
    }
    
    .cod-checkmark-kick {
        left: 19px;
        top: 39px;
        height: 9px;
    }
}
</style>
`;

// Inject additional CSS
if (!document.getElementById('cod-verifier-additional-css')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'cod-verifier-additional-css';
    styleElement.innerHTML = additionalCSS;
    document.head.appendChild(styleElement);
}