import { useState } from 'react';
import { AiOutlineUser } from "react-icons/ai";
import { FiMail } from "react-icons/fi";
import { RiLockPasswordLine } from "react-icons/ri";
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { companySignup } from '../../api';

const schema = yup.object().shape({
  companyName: yup.string().required('Company Name is required'),
  industryType: yup.string().required('Industry Type is required'),
  adminName: yup.string().required('Admin Name is required'),
  adminEmail: yup.string().email('Invalid email format').required('Email is required'),
  adminPassword: yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain an uppercase letter')
    .matches(/[a-z]/, 'Password must contain a lowercase letter')
    .matches(/[0-9]/, 'Password must contain a number')
    .matches(/[\W_]/, 'Password must contain a special character')
    .required('Password is required'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('adminPassword'), null], 'Passwords must match')
    .required('Confirm password is required'),
  companyAddress: yup.string().required('Company Address is required'),
  city: yup.string().required('City is required'),
  state: yup.string().required('State is required'),
  postalCode: yup.string().required('Postal Code is required'),
  phoneNumber: yup.string().required('Phone Number is required'),
  employees: yup.number().min(1, 'Enter number of employees'),
  website: yup.string().url('Invalid URL format'),
});

const SignUp = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data) => {
    console.log("Company Registration Data Submitted:", data);

    setLoading(true);
    setServerError(null);
    try {
      const response = await companySignup({
        companyName: data.companyName,
        industryType: data.industryType,
        adminName: data.adminName,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
        companyAddress: data.companyAddress,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        phoneNumber: data.phoneNumber,
        employees: parseInt(data.employees) || 0,
        website: data.website || ''
      });

      if (response) {
        console.log('Company registered successfully');
        navigate('/'); // Redirect to login page
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Internal server error';
      setServerError(errorMessage);
      console.error('Error during company signup:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-r from-[#125151] via-[#187eb9] to-[#0a6e62] font-verdana text-white p-4">
      <div className="bg-[#000000] bg-opacity-80 p-10 rounded-3xl shadow-2xl w-full max-w-2xl transform transition-all duration-500 ease-in-out hover:scale-105 hover:shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <h2 className="text-3xl font-extrabold mb-8 text-center tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#c04934] to-[#17bbbb]">
          Company Admin Registration
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Company Name */}
            <div className="inputBox">
              <label htmlFor="companyName" className="text-white text-sm">Company Name</label>
              <input
                type='text'
                name="companyName"
                id="companyName"
                placeholder='Company Name'
                {...register('companyName')}
                className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
              />
              {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName.message}</p>}
            </div>

            {/* Industry Type */}
            <div className="inputBox">
              <label htmlFor="industryType" className="text-white text-sm">Industry Type</label>
              <input
                type='text'
                name="industryType"
                id="industryType"
                placeholder='e.g., Technology, Healthcare'
                {...register('industryType')}
                className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
              />
              {errors.industryType && <p className="text-red-500 text-xs mt-1">{errors.industryType.message}</p>}
            </div>

            {/* Admin Name */}
            <div className="inputBox">
              <label htmlFor="adminName" className="text-white text-sm">Admin Name</label>
              <input
                type='text'
                name="adminName"
                id="adminName"
                placeholder='Your Full Name'
                {...register('adminName')}
                className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
              />
              {errors.adminName && <p className="text-red-500 text-xs mt-1">{errors.adminName.message}</p>}
            </div>

            {/* Admin Email */}
            <div className="inputBox">
              <label htmlFor="adminEmail" className="text-white text-sm">Admin Email</label>
              <input
                type="email"
                name="adminEmail"
                id="adminEmail"
                placeholder='Email Address'
                {...register('adminEmail')}
                className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
              />
              {errors.adminEmail && <p className="text-red-500 text-xs mt-1">{errors.adminEmail.message}</p>}
            </div>

            {/* Password */}
            <div className="inputBox relative">
              <label htmlFor="adminPassword" className="text-white text-sm">Password</label>
              <div className="flex items-center relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="adminPassword"
                  id="adminPassword"
                  placeholder='Password'
                  {...register('adminPassword')}
                  className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
                />
                <div
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
                >
                  {showPassword ? <AiFillEye className="text-gray-900" /> : <AiFillEyeInvisible className="text-gray-900" />}
                </div>
              </div>
              {errors.adminPassword && <p className="text-red-500 text-xs mt-1">{errors.adminPassword.message}</p>}
            </div>

            {/* Confirm Password */}
            <div className="inputBox relative">
              <label htmlFor="confirmPassword" className="text-white text-sm">Confirm Password</label>
              <div className="flex items-center relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  id="confirmPassword"
                  placeholder='Confirm Password'
                  {...register('confirmPassword')}
                  className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
                />
                <div
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
                >
                  {showConfirmPassword ? <AiFillEye className="text-gray-900" /> : <AiFillEyeInvisible className="text-gray-900" />}
                </div>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            {/* Company Address */}
            <div className="inputBox md:col-span-2">
              <label htmlFor="companyAddress" className="text-white text-sm">Company Address</label>
              <input
                type='text'
                name="companyAddress"
                id="companyAddress"
                placeholder='Street Address'
                {...register('companyAddress')}
                className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
              />
              {errors.companyAddress && <p className="text-red-500 text-xs mt-1">{errors.companyAddress.message}</p>}
            </div>

            {/* City */}
            <div className="inputBox">
              <label htmlFor="city" className="text-white text-sm">City</label>
              <input
                type='text'
                name="city"
                id="city"
                placeholder='City'
                {...register('city')}
                className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
              />
              {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
            </div>

            {/* State */}
            <div className="inputBox">
              <label htmlFor="state" className="text-white text-sm">State</label>
              <input
                type='text'
                name="state"
                id="state"
                placeholder='State'
                {...register('state')}
                className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
              />
              {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>}
            </div>

            {/* Postal Code */}
            <div className="inputBox">
              <label htmlFor="postalCode" className="text-white text-sm">Postal Code</label>
              <input
                type='text'
                name="postalCode"
                id="postalCode"
                placeholder='Postal Code'
                {...register('postalCode')}
                className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
              />
              {errors.postalCode && <p className="text-red-500 text-xs mt-1">{errors.postalCode.message}</p>}
            </div>

            {/* Phone Number */}
            <div className="inputBox">
              <label htmlFor="phoneNumber" className="text-white text-sm">Phone Number</label>
              <input
                type='tel'
                name="phoneNumber"
                id="phoneNumber"
                placeholder='Phone Number'
                {...register('phoneNumber')}
                className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
              />
              {errors.phoneNumber && <p className="text-red-500 text-xs mt-1">{errors.phoneNumber.message}</p>}
            </div>

            {/* Number of Employees */}
            <div className="inputBox">
              <label htmlFor="employees" className="text-white text-sm">Number of Employees</label>
              <input
                type='number'
                name="employees"
                id="employees"
                placeholder='No. of Employees'
                {...register('employees')}
                className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
              />
              {errors.employees && <p className="text-red-500 text-xs mt-1">{errors.employees.message}</p>}
            </div>

            {/* Website */}
            <div className="inputBox">
              <label htmlFor="website" className="text-white text-sm">Website (Optional)</label>
              <input
                type='url'
                name="website"
                id="website"
                placeholder='https://example.com'
                {...register('website')}
                className="w-full px-4 py-2 mt-1 text-gray-900 bg-gray-200 bg-opacity-90 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bd4b37] transition duration-300"
              />
              {errors.website && <p className="text-red-500 text-xs mt-1">{errors.website.message}</p>}
            </div>
          </div>

          {/* Server error display */}
          {serverError && <p className="text-red-500 text-center mt-4 text-sm">{serverError}</p>}

          {/* Submit Button */}
          <div className='divBtn mt-6'>
            <button type="submit" className='w-full py-3 bg-gradient-to-r from-[#bd4b37] to-[#125151] hover:from-[#9c3f30] hover:to-[#0a3939] text-white font-semibold rounded-lg transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-lg' disabled={loading}>
              {loading ? 'Registering Company...' : 'REGISTER COMPANY'}
            </button>
          </div>
        </form>

        <div className='dont mt-8 text-center text-gray-400'>
          <p>Already registered? <Link to="/login"><span className="text-[#bd4b37] hover:text-[#9c3f30] transition duration-300 ease-in-out">Sign in</span></Link></p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
