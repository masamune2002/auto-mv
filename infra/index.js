"use strict";
const pulumi = require("@pulumi/pulumi");
const aws    = require("@pulumi/aws");

const videosBucket = new aws.s3.Bucket("autoMvVideosBucket", {
  forceDestroy: true
});

const webBucket = new aws.s3.Bucket("autoMvWebBucket", {
  website:      { indexDocument: "index.html" },
  forceDestroy: true
});

function publicReadPolicyFor(bucket, oai) {
  return pulumi.all([bucket.arn, oai.iamArn]).apply(([arn, oaiArn]) =>
    JSON.stringify({
      Version: "2008-10-17",
      Statement: [{
        Sid:     "AllowCloudFrontServicePrincipalReadOnly",
        Effect:  "Allow",
        Principal: { "AWS": [oaiArn] }, // as an array
        Action:   "s3:GetObject",
        Resource: `${arn}/*`,
      }],
    })
  );
}

const oai = new aws.cloudfront.OriginAccessIdentity("oai");

new aws.s3.BucketPolicy("videosBucketPolicy", {
  bucket: videosBucket.id,
  policy: publicReadPolicyFor(videosBucket, oai),
});

new aws.s3.BucketPolicy("webBucketPolicy", {
  bucket: webBucket.id,
  policy: publicReadPolicyFor(webBucket, oai),
});

const cdn = new aws.cloudfront.Distribution("autoMvCdn", {
  origins: [
    {
      originId:   "auto-mv-web-origin",
      domainName: webBucket.bucketRegionalDomainName,
      s3OriginConfig: {
        originAccessIdentity: oai.cloudfrontAccessIdentityPath,
      },
    },
    {
      originId:   "auto-mv-videos-origin",
      domainName: videosBucket.bucketRegionalDomainName,
      s3OriginConfig: {
        originAccessIdentity: oai.cloudfrontAccessIdentityPath,
      },
    },
  ],

  defaultCacheBehavior: {
    targetOriginId:       "auto-mv-web-origin",  // match originId
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods:       ["GET","HEAD"],
    cachedMethods:        ["GET","HEAD"],
    forwardedValues: {
      queryString: false,
      cookies:     { forward: "none" },
    }
  },

  cacheBehaviors: [
    {
      pathPattern:          "/videos/*",
      targetOriginId:       "auto-mv-videos-origin",  // match originId
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods:       ["GET","HEAD"],
      cachedMethods:        ["GET","HEAD"],
      forwardedValues: {
        queryString: false,
        cookies:     { forward: "none" },
      }
    },
    {
      pathPattern:          "/api/*",
      targetOriginId:       "api-origin",             // you’ll add this origin later
      allowedMethods:       ["GET","HEAD","OPTIONS"],
      cachedMethods:        ["GET","HEAD"],
      forwardedValues: {
        queryString: false,
        cookies:     { forward: "none" },
      }
    },
  ],

  restrictions: {
    geoRestriction: {
      restrictionType: "none",
    },
  },

  viewerCertificate: {
    cloudfrontDefaultCertificate: true,
  },

  priceClass:    "PriceClass_All",
  enabled:       true,
  isIpv6Enabled: true,
});

exports.videosBucketName = videosBucket.id;
exports.webBucketName    = webBucket.id;

