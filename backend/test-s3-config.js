#!/usr/bin/env node

/**
 * Test S3 Configuration
 * This script tests if the S3 configuration is working correctly
 * and can read/write the steps files that the webhook creates.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const REGION = process.env.AWS_REGION || 'us-west-1';
const BUCKET = process.env.AWS_BUCKET_NAME || 'adaptv3-training-videos';

console.log('🔧 Testing S3 Configuration...');
console.log(`   Region: ${REGION}`);
console.log(`   Bucket: ${BUCKET}`);
console.log(`   Access Key: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing'}`);
console.log(`   Secret Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing'}`);

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ Missing AWS credentials. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
  process.exit(1);
}

const s3 = new S3Client({ 
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

async function testS3Operations() {
  const testKey = 'test-s3-config.json';
  const testData = {
    test: true,
    timestamp: new Date().toISOString(),
    message: 'S3 configuration test'
  };

  try {
    console.log('\n📤 Testing S3 write...');
    
    // Test write
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: testKey,
      Body: JSON.stringify(testData, null, 2),
      ContentType: 'application/json'
    });
    
    await s3.send(putCommand);
    console.log('✅ S3 write successful');

    console.log('\n📖 Testing S3 read...');
    
    // Test read
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET,
      Key: testKey
    });
    
    const response = await s3.send(getCommand);
    const bodyContents = await response.Body.transformToString();
    const readData = JSON.parse(bodyContents);
    
    console.log('✅ S3 read successful');
    console.log('   Read data:', readData);

    console.log('\n🧹 Cleaning up test file...');
    
    // Clean up (optional - you can comment this out to keep the test file)
    // const deleteCommand = new DeleteObjectCommand({ Bucket: BUCKET, Key: testKey });
    // await s3.send(deleteCommand);
    // console.log('✅ Test file cleaned up');

    console.log('\n🎉 S3 configuration test PASSED!');
    console.log('   Your S3 setup is working correctly.');
    console.log('   The issue with steps not loading is likely fixed now.');

  } catch (error) {
    console.error('\n❌ S3 configuration test FAILED:', error.message);
    
    if (error.name === 'AccessDenied') {
      console.error('   This looks like a permissions issue. Check your AWS credentials and bucket permissions.');
    } else if (error.name === 'NoSuchBucket') {
      console.error('   The bucket does not exist. Check your AWS_BUCKET_NAME environment variable.');
    } else if (error.name === 'InvalidAccessKeyId') {
      console.error('   Invalid AWS access key. Check your AWS_ACCESS_KEY_ID.');
    } else if (error.name === 'SignatureDoesNotMatch') {
      console.error('   Invalid AWS secret key. Check your AWS_SECRET_ACCESS_KEY.');
    }
    
    process.exit(1);
  }
}

// Run the test
testS3Operations().catch(console.error);
