FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies for OpenCV
RUN dnf install -y mesa-libGL

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Lambda function code
COPY lambda_function.py .

# Set the Lambda handler
CMD ["lambda_function.lambda_handler"]
