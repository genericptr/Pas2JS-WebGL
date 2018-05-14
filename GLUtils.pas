unit GLUtils;
interface
uses
	BrowserConsole, Web, WebGL, JS;

type
	TShader = class
		public
			constructor Create (context: TJSWebGLRenderingContext; vertexShaderSource, fragmentShaderSource: string);
			procedure Compile;
			procedure Link;
			procedure Use;

			function GetAttribLocation (name: string): GLint;
			procedure BindAttribLocation (index: GLuint; name: string);

			procedure SetUniformMat4 (name: string; value: TJSFloat32List);

		private
			gl: TJSWebGLRenderingContext;
			vertexShader: TJSWebGLShader;
			fragmentShader: TJSWebGLShader;
			programID: TJSWebGLProgram;

			function CreateShader (theType: GLenum; source: string): TJSWebGLShader;
	end;


implementation

procedure Fatal (messageString: string); overload;
begin
	writeln('*** FATAL: ', messageString);
	exit;
end;

// TODO: toll free bridge to FPC strings
procedure Fatal (messageString: TJSString); overload;
begin
	writeln('*** FATAL: ', messageString);
	exit;
end;

procedure GLFatal (gl: TJSWebGLRenderingContext; messageString: string = 'Fatal OpenGL error'); 
var
	error: integer;
begin
	error := gl.getError();
	if error <> gl.NO_ERROR then
		begin
			// TODO: case doesn't work?
			//case error of
			//	gl.INVALID_VALUE:
			//		messageString := messageString+' (GL_INVALID_VALUE)';
			//	gl.INVALID_OPERATION:
			//		messageString := messageString+' (GL_INVALID_OPERATION)';
			//	gl.INVALID_ENUM:
			//		messageString := messageString+' (GL_INVALID_ENUM)';
			//	otherwise
			//		messageString := messageString+' '+IntToStr(error);
			//end;
			// TODO: IntoStr doesn't work? cast to string or TJSString doesn't work either
			//messageString := messageString+' '+IntToStr(error);
			Fatal(messageString);
		end;
end;

procedure TShader.SetUniformMat4 (name: string; value: TJSFloat32List);
var
	location: TJSWebGLUniformLocation;
begin
	location := gl.getUniformLocation(programID, name);
	//writeln(name, ' = ', location, ' => ', value);
	GLFatal(gl, 'gl.getUniformLocation');
	gl.uniformMatrix4fv(location, false, value);
	GLFatal(gl, 'gl.uniformMatrix4fv');
end;

function TShader.GetAttribLocation (name: string): GLint;
begin
	result := gl.getAttribLocation(programID, name);
end;

procedure TShader.BindAttribLocation (index: GLuint; name: string);
begin
	gl.bindAttribLocation(programID, index, name);
	//GLFatal('glBindAttribLocation '+IntToStr(index)+':'+name);
end;

constructor TShader.Create (context: TJSWebGLRenderingContext; vertexShaderSource, fragmentShaderSource: string);
begin
	gl := context;
	vertexShader := CreateShader(gl.VERTEX_SHADER, vertexShaderSource);
	fragmentShader := CreateShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
end;

function TShader.CreateShader(theType: GLenum; source: string): TJSWebGLShader; 
var
	shader: TJSWebGLShader;
begin
	shader := gl.createShader(theType);
	if shader = nil then
		Fatal('create shader failed');
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if gl.getShaderParameter(shader, gl.COMPILE_STATUS) then
		begin
			//writeln('loaded shader ', theType);
			exit(shader);
		end
	else
		begin
			Fatal(gl.getShaderInfoLog(shader));
			//gl.deleteShader(shader);
		end;
end;

procedure TShader.Compile; 
begin
	programID := gl.createProgram;
	gl.attachShader(programID, vertexShader);
	gl.attachShader(programID, fragmentShader);
end;

procedure TShader.Link; 
begin
  gl.linkProgram(programID);
  if not gl.getProgramParameter(programID, gl.LINK_STATUS) then
  	begin
  		Fatal(gl.getProgramInfoLog(programID));
  		//gl.deleteProgram(programID);
  	end;
end;

procedure TShader.Use; 
begin
	gl.useProgram(programID);
end;

end.