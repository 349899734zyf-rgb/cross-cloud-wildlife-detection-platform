FROM --platform=linux/amd64 public.ecr.aws/lambda/python:3.12

RUN dnf install -y mesa-libGL cmake gcc gcc-c++ git

# Bundle YOLOv5 v7.0 directly — avoids torch.hub runtime downloads and
# eliminates surprise missing-module errors from GitHub HEAD changes.
RUN git clone -b v7.0 --depth 1 https://github.com/ultralytics/yolov5 /opt/yolov5

# Patch pkg_resources import — removed from Python 3.12 stdlib; provide fallback.
RUN python3 -c "\
f = '/opt/yolov5/utils/general.py'; \
src = open(f).read(); \
src = src.replace( \
    'import pkg_resources as pkg', \
    'try:\n    import pkg_resources as pkg\nexcept ImportError:\n    class pkg:\n        parse_version = staticmethod(lambda v: tuple(int(x) for x in str(v).split(\".\")[:3] if x.isdigit()))\n        require = staticmethod(lambda *a, **k: None)' \
); \
open(f, 'w').write(src)"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Install YOLOv5 v7.0 own requirements (ipython is optional but avoids ImportError)
RUN pip install --no-cache-dir -r /opt/yolov5/requirements.txt ipython

COPY lambda_function.py .

CMD ["lambda_function.lambda_handler"]
